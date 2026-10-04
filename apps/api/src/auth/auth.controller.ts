import { Body, Controller, Get, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  loginRequestSchema,
  signupRequestSchema,
  verifyOtpRequestSchema,
  type LoginRequest,
  type SignupRequest,
  type VerifyOtpRequest,
} from "@foodscanner/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import type { RequestUser } from "./auth.types";
import { Public } from "./public.decorator";

// Tighter than the global default (60/min) — these are unauthenticated,
// tracked by IP, and are exactly what brute-force/OTP-guessing/account-
// enumeration attempts target.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("auth/signup")
  signup(
    @Body(new ZodValidationPipe(signupRequestSchema)) body: SignupRequest
  ) {
    return this.auth.signup(body);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("auth/verify-otp")
  verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpRequestSchema)) body: VerifyOtpRequest
  ) {
    return this.auth.verifyOtp(body);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("auth/login")
  login(@Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest) {
    return this.auth.login(body);
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.userId);
  }
}
