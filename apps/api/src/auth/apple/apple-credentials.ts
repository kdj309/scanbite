import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decryptSecret, encryptSecret } from "../../common/secret-box";
import type { Env } from "../../config/env";
import type { UserDocument } from "../../database/schemas/user.schema";
import { AppleTokenClient } from "./apple-token-client";

/**
 * Apple's refresh token for an account (Apple TN3194): obtained by
 * exchanging the sign-in authorization code, kept encrypted on the user,
 * revoked at Apple when the account is deleted.
 */
@Injectable()
export class AppleCredentials {
  private readonly logger = new Logger(AppleCredentials.name);

  constructor(
    private readonly apple: AppleTokenClient,
    private readonly config: ConfigService<Env, true>
  ) {}

  /** Validates the one-time code with Apple; returns its refresh token. */
  exchange(code: string, clientId: string): Promise<string> {
    return this.apple.exchangeCode(code, clientId);
  }

  /** Stores the token on the user (caller saves). */
  attach(user: UserDocument, refreshToken: string, clientId: string): void {
    user.apple_refresh_token_enc = encryptSecret(refreshToken, this.key());
    user.apple_client_id = clientId;
  }

  /** Removes Apple from the user entirely (caller saves). */
  detach(user: UserDocument): void {
    user.apple_sub = undefined;
    user.apple_refresh_token_enc = undefined;
    user.apple_client_id = undefined;
  }

  /**
   * Revokes the stored token at Apple. Failures are logged, not thrown:
   * account deletion must still go ahead (TN3194).
   */
  async revoke(user: UserDocument): Promise<void> {
    if (!user.apple_refresh_token_enc || !user.apple_client_id) {
      return;
    }
    try {
      await this.apple.revoke(
        decryptSecret(user.apple_refresh_token_enc, this.key()),
        user.apple_client_id
      );
    } catch (error) {
      this.logger.warn(
        `Apple revoke failed for user=${user.id}: ${String(error)}`
      );
    }
  }

  private key(): Buffer {
    const key = this.config.get("TOKEN_ENCRYPTION_KEY", { infer: true });
    if (!key) {
      throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
    }
    return key;
  }
}
