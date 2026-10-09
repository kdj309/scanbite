import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  appleNotificationRequestSchema,
  appleSignInRequestSchema,
  refreshTokenRequestSchema,
  socialSignInRequestSchema,
  type AppleNotificationRequest,
  type AppleSignInRequest,
  type RefreshTokenRequest,
  type SocialSignInRequest,
} from "@foodscanner/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AccountService } from "./account.service";
import { AppleNotificationService } from "./apple/apple-notification.service";
import type { RequestUser } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";
import { OptionalAuth, Public } from "./public.decorator";
import { SessionService } from "./session.service";
import { SocialSignInService } from "./social-sign-in.service";

// Per IP (or per user when a token is sent), tighter than the global 60/min.
// Creating/signing into accounts is what mass-account-creation targets.
const SIGN_IN_LIMIT = { default: { limit: 5, ttl: 60_000 } };
// Called routinely (refresh on every access-token expiry, logout, Apple's
// low-volume notifications): more headroom, still bounded.
const FREQUENT_LIMIT = { default: { limit: 30, ttl: 60_000 } };

@Controller("auth")
export class AuthController {
  constructor(
    private readonly accounts: AccountService,
    private readonly sessions: SessionService,
    private readonly socialSignIn: SocialSignInService,
    private readonly appleNotifications: AppleNotificationService
  ) {}

  @Public()
  @Throttle(SIGN_IN_LIMIT)
  @Post("anonymous")
  anonymous() {
    return this.accounts.createAnonymous();
  }

  /** With a Bearer token the identity is linked to that (anonymous) account. */
  @OptionalAuth()
  @Throttle(SIGN_IN_LIMIT)
  @Post("google")
  google(
    @Body(new ZodValidationPipe(socialSignInRequestSchema))
    body: SocialSignInRequest,
    @CurrentUser() user?: RequestUser
  ) {
    return this.socialSignIn.signIn(
      "google",
      body.id_token,
      body.nonce,
      user?.userId ?? null
    );
  }

  @OptionalAuth()
  @Throttle(SIGN_IN_LIMIT)
  @Post("apple")
  apple(
    @Body(new ZodValidationPipe(appleSignInRequestSchema))
    body: AppleSignInRequest,
    @CurrentUser() user?: RequestUser
  ) {
    return this.socialSignIn.signIn(
      "apple",
      body.id_token,
      body.nonce,
      user?.userId ?? null,
      {
        appleAuthorizationCode: body.authorization_code,
        givenName: body.given_name,
      }
    );
  }

  /** Apple server-to-server notifications; Apple signs the payload. */
  @Public()
  @Throttle(FREQUENT_LIMIT)
  @Post("apple/notifications")
  @HttpCode(200)
  async receiveAppleNotification(
    @Body(new ZodValidationPipe(appleNotificationRequestSchema))
    body: AppleNotificationRequest
  ): Promise<void> {
    await this.appleNotifications.handle(body.payload);
  }

  @Public()
  @Throttle(FREQUENT_LIMIT)
  @Post("refresh")
  refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    body: RefreshTokenRequest
  ) {
    return this.sessions.refresh(body.refresh_token);
  }

  @Public()
  @Throttle(FREQUENT_LIMIT)
  @Post("logout")
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema))
    body: RefreshTokenRequest
  ): Promise<void> {
    await this.sessions.logout(body.refresh_token);
  }
}
