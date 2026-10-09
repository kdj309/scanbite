import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import type { AuthTokenResponse } from "@foodscanner/shared";
import { Model, Types } from "mongoose";
import { createHash, randomBytes } from "node:crypto";
import type { Env } from "../config/env";
import {
  RefreshToken,
  RefreshTokenDocument,
  type RefreshRevokedReason,
} from "../database/schemas/refresh-token.schema";
import { User, UserDocument } from "../database/schemas/user.schema";
import type { JwtPayload } from "./auth.types";
import { serializeUser } from "./serialize-user";

// A just-rotated refresh token presented again within this window is a
// retry (response lost on a weak connection, or two requests refreshing at
// once), not theft: answer with a fresh pair instead of signing the user
// out everywhere — which for an anonymous account would lose it for good.
const REFRESH_REUSE_GRACE_MS = 60 * 1000;

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Access + refresh tokens: issuing, rotating, revoking. */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokens: Model<RefreshTokenDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>
  ) {}

  async issue(
    user: UserDocument,
    accountSwitched = false
  ): Promise<AuthTokenResponse> {
    const payload: JwtPayload = { sub: user.id as string, role: user.role };
    const access_token = await this.jwt.signAsync(payload);
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(
      access_token
    );
    return {
      access_token,
      token_type: "Bearer",
      expires_in: exp - iat,
      refresh_token: await this.createRefreshToken(user._id),
      user: serializeUser(user),
      account_switched: accountSwitched,
    };
  }

  /**
   * Exchanges a refresh token for a new pair. The presented token is retired
   * atomically, so two concurrent calls can't both rotate it; see
   * REFRESH_REUSE_GRACE_MS for what a re-presented token gets.
   */
  async refresh(token: string): Promise<AuthTokenResponse> {
    const tokenHash = hashRefreshToken(token);
    const now = new Date();
    const rotated = await this.refreshTokens
      .findOneAndUpdate(
        { token_hash: tokenHash, revoked_at: null, expires_at: { $gt: now } },
        { $set: { revoked_at: now, revoked_reason: "rotated" } }
      )
      .exec();
    const userId = rotated?.user_id ?? (await this.retryOwner(tokenHash, now));

    const user = await this.users.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    return this.issue(user);
  }

  /** Revokes one session. Unknown or already-revoked tokens are not an error. */
  async logout(token: string): Promise<void> {
    await this.refreshTokens
      .updateOne(
        { token_hash: hashRefreshToken(token), revoked_at: null },
        { $set: { revoked_at: new Date(), revoked_reason: "logout" } }
      )
      .exec();
  }

  async revokeAll(
    userId: Types.ObjectId,
    reason: RefreshRevokedReason = "signed_out"
  ): Promise<void> {
    await this.refreshTokens
      .updateMany(
        { user_id: userId, revoked_at: null },
        { $set: { revoked_at: new Date(), revoked_reason: reason } }
      )
      .exec();
  }

  /** Account deletion: remove every session row for the user. */
  async deleteAll(userId: Types.ObjectId): Promise<void> {
    await this.refreshTokens.deleteMany({ user_id: userId }).exec();
  }

  /**
   * A token that couldn't be rotated: a recent rotation is a retry and its
   * owner gets a new pair; an older rotated one is reuse of a copied token,
   * so every session for that user is revoked.
   */
  private async retryOwner(
    tokenHash: string,
    now: Date
  ): Promise<Types.ObjectId> {
    const reused = await this.refreshTokens
      .findOne({ token_hash: tokenHash, revoked_at: { $ne: null } })
      .exec();
    // Only a rotated token signals theft; one ended by logout/sign-out is
    // just stale (e.g. a late refresh from the phone that logged out).
    if (!reused || reused.revoked_reason !== "rotated") {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const isRecentRotation =
      reused.revoked_at !== null &&
      now.getTime() - reused.revoked_at.getTime() <= REFRESH_REUSE_GRACE_MS &&
      reused.expires_at > now;
    if (!isRecentRotation) {
      this.logger.warn(
        `refresh token reuse for user=${String(reused.user_id)}; revoking all sessions`
      );
      await this.revokeAll(reused.user_id, "reuse_detected");
      throw new UnauthorizedException("Invalid refresh token");
    }
    return reused.user_id;
  }

  private async createRefreshToken(userId: Types.ObjectId): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    const ttlDays = this.config.get("REFRESH_TOKEN_TTL_DAYS", { infer: true });
    await this.refreshTokens.create({
      user_id: userId,
      token_hash: hashRefreshToken(token),
      expires_at: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
    });
    return token;
  }
}
