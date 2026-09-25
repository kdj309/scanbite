import { Body, Controller, Get, Post } from "@nestjs/common";
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

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("auth/signup")
  signup(
    @Body(new ZodValidationPipe(signupRequestSchema)) body: SignupRequest,
  ) {
    return this.auth.signup(body);
  }

  @Public()
  @Post("auth/verify-otp")
  verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpRequestSchema)) body: VerifyOtpRequest,
  ) {
    return this.auth.verifyOtp(body);
  }

  @Public()
  @Post("auth/login")
  login(@Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest) {
    return this.auth.login(body);
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.userId);
  }
}
