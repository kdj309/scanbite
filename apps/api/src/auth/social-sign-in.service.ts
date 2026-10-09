import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type { AuthTokenResponse } from "@foodscanner/shared";
import { Model } from "mongoose";
import { RedisCacheService } from "../common/redis-cache.service";
import type { Env } from "../config/env";
import {
  User,
  UserDocument,
  type UserRole,
} from "../database/schemas/user.schema";
import { AccountService } from "./account.service";
import { AppleCredentials } from "./apple/apple-credentials";
import { IdTokenVerifier } from "./id-token-verifier";
import { hashNonce } from "./nonce";
import { SessionService } from "./session.service";
import { isAnonymous } from "./sign-in-method";
import {
  decideSocialSignIn,
  isEmailTrustedForLinking,
  type SocialProvider,
} from "./social-sign-in";

export type SocialSignInExtras = {
  /** Apple only: one-time code, validated at Apple's /auth/token. */
  appleAuthorizationCode?: string;
  /** Apple only: sent on the first authorization; names the Self member. */
  givenName?: string;
};

const SUB_FIELD = { google: "google_sub", apple: "apple_sub" } as const;

// A nonce is remembered a little longer than an ID token can live
// (Google/Apple tokens last ~10 minutes), so it can't be replayed while
// the token it belongs to is still valid.
const NONCE_TTL_SECONDS = 15 * 60;

/**
 * Google/Apple sign-in: verify the token, consume the nonce, validate
 * Apple's code, pick the account (see decideSocialSignIn), apply the
 * identity, issue tokens.
 */
@Injectable()
export class SocialSignInService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly idTokens: IdTokenVerifier,
    private readonly redis: RedisCacheService,
    private readonly appleCredentials: AppleCredentials,
    private readonly accounts: AccountService,
    private readonly sessions: SessionService
  ) {}

  /** `currentUserId`: the caller's account (normally the install's anonymous one). */
  async signIn(
    provider: SocialProvider,
    idToken: string,
    rawNonce: string,
    currentUserId: string | null,
    extras: SocialSignInExtras = {}
  ): Promise<AuthTokenResponse> {
    const identity = await this.idTokens.verify(provider, idToken, rawNonce);
    await this.claimNonce(rawNonce);
    // Apple TN3194: validate the code before any account is touched.
    const appleRefreshToken =
      provider === "apple"
        ? await this.exchangeAppleCode(extras, identity.audience)
        : null;

    const subField = SUB_FIELD[provider];
    // `email` is stored when free; only the trusted one (Gmail/Workspace)
    // may route this sign-in to another account or grant admin.
    const email = identity.emailVerified
      ? (identity.email?.toLowerCase() ?? null)
      : null;
    const trustedEmail = isEmailTrustedForLinking(provider, identity)
      ? email
      : null;

    const [current, bySub, byEmail] = await Promise.all([
      currentUserId ? this.users.findById(currentUserId).exec() : null,
      this.users.findOne({ [subField]: identity.sub }).exec(),
      trustedEmail
        ? this.users
            .findOne({ email: trustedEmail, email_verified: true })
            .exec()
        : null,
    ]);
    if (currentUserId && !current) {
      throw new UnauthorizedException();
    }

    const candidate = (user: UserDocument | null) =>
      user
        ? { id: user.id as string, provider_sub: user[subField] ?? null }
        : null;
    const decision = decideSocialSignIn({
      current: candidate(current),
      bySub: candidate(bySub),
      byVerifiedEmail: candidate(byEmail),
    });
    if (decision.kind === "conflict") {
      throw new ConflictException(decision.reason);
    }

    const user =
      decision.kind === "create"
        ? // Created with its identity in the same write: two racing sign-ins
          // for one new identity then fail on the unique index, not orphan.
          await this.accounts.create({ role: "user", [subField]: identity.sub })
        : this.loadedAccount(decision.userId, [current, bySub, byEmail]);
    user[subField] = identity.sub;
    if (decision.kind !== "use-existing") {
      await this.applyEmailAndRole(user, email, trustedEmail);
    }
    if (appleRefreshToken) {
      this.appleCredentials.attach(user, appleRefreshToken, identity.audience);
    }
    await user.save();

    const switched = decision.kind === "use-existing" && decision.switched;
    if (switched && current && isAnonymous(current)) {
      await this.accounts.discardIfEmpty(current);
    }
    if (extras.givenName) {
      await this.accounts.nameSelfIfUnnamed(user, extras.givenName);
    }
    return this.sessions.issue(user, switched);
  }

  /**
   * Each nonce signs in once. Runs after the token check so random requests
   * can't fill Redis; SET NX makes two simultaneous replays race safely.
   */
  private async claimNonce(rawNonce: string): Promise<void> {
    const claimed = await this.redis.client.set(
      `auth:nonce:${hashNonce(rawNonce)}`,
      "1",
      "EX",
      NONCE_TTL_SECONDS,
      "NX"
    );
    if (claimed !== "OK") {
      throw new UnauthorizedException("This sign-in request was already used");
    }
  }

  private exchangeAppleCode(
    extras: SocialSignInExtras,
    clientId: string
  ): Promise<string> {
    if (!extras.appleAuthorizationCode) {
      throw new UnauthorizedException("Apple authorization code is required");
    }
    return this.appleCredentials.exchange(
      extras.appleAuthorizationCode,
      clientId
    );
  }

  /** The decided account, from the ones already loaded for the decision. */
  private loadedAccount(
    userId: string,
    loaded: Array<UserDocument | null>
  ): UserDocument {
    const user = loaded.find((candidate) => candidate?.id === userId);
    if (!user) {
      throw new Error(`decided account ${userId} was not loaded`);
    }
    return user;
  }

  /**
   * New or newly linked account: store the email if no other account uses
   * it (emails are unique), mark it verified only when it's the trusted one,
   * and grant admin only through that trusted email.
   */
  private async applyEmailAndRole(
    user: UserDocument,
    email: string | null,
    trustedEmail: string | null
  ): Promise<void> {
    if (!user.email && email && !(await this.users.exists({ email }))) {
      user.email = email;
    }
    if (trustedEmail && user.email === trustedEmail) {
      user.email_verified = true;
    }
    if (user.role !== "admin") {
      user.role = this.roleFor(trustedEmail);
    }
  }

  /**
   * Admin only for ADMIN_EMAIL proven through a trusted email, so nobody can
   * become admin by getting that address onto an account some other way.
   */
  private roleFor(trustedEmail: string | null): UserRole {
    const adminEmail = this.config.get("ADMIN_EMAIL", { infer: true });
    return trustedEmail &&
      adminEmail &&
      trustedEmail === adminEmail.toLowerCase()
      ? "admin"
      : "user";
  }
}
