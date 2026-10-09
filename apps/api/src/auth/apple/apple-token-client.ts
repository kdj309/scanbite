import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchWithTimeout } from "../../common/fetch-with-timeout";
import type { Env } from "../../config/env";
import { buildAppleClientSecret } from "./apple-client-secret";

const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

/** Port for Apple's REST API so tests don't call Apple. */
export abstract class AppleTokenClient {
  /** Validates the one-time authorization code; returns Apple's refresh token. */
  abstract exchangeCode(code: string, clientId: string): Promise<string>;
  /** Invalidates the refresh token at Apple (account deletion). */
  abstract revoke(refreshToken: string, clientId: string): Promise<void>;
}

@Injectable()
export class HttpAppleTokenClient extends AppleTokenClient {
  private readonly logger = new Logger(HttpAppleTokenClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  async exchangeCode(code: string, clientId: string): Promise<string> {
    const response = await this.postToApple(APPLE_TOKEN_URL, clientId, {
      code,
      grant_type: "authorization_code",
    });
    const body = response.ok
      ? ((await response.json()) as { refresh_token?: string })
      : {};
    if (!body.refresh_token) {
      // e.g. 400 invalid_grant = expired/used/forged code. Don't echo Apple's body.
      this.logger.warn(`Apple code exchange failed: ${response.status}`);
      throw new UnauthorizedException("Apple sign-in could not be confirmed");
    }
    return body.refresh_token;
  }

  async revoke(refreshToken: string, clientId: string): Promise<void> {
    const response = await this.postToApple(APPLE_REVOKE_URL, clientId, {
      token: refreshToken,
      token_type_hint: "refresh_token",
    });
    if (!response.ok) {
      throw new Error(`Apple token revocation failed: ${response.status}`);
    }
  }

  /** Apple's form POST, authenticated with a freshly signed client secret. */
  private async postToApple(
    url: string,
    clientId: string,
    params: Record<string, string>
  ): Promise<Response> {
    const teamId = this.config.get("APPLE_TEAM_ID", { infer: true });
    const keyId = this.config.get("APPLE_KEY_ID", { infer: true });
    const privateKey = this.config.get("APPLE_PRIVATE_KEY", { infer: true });
    if (!teamId || !keyId || !privateKey) {
      throw new ServiceUnavailableException("apple sign-in is not configured");
    }
    const clientSecret = await buildAppleClientSecret(
      { teamId, keyId, privateKey },
      clientId
    );
    return fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        ...params,
      }),
    });
  }
}
