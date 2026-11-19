import { Body, Controller, Delete, Get, HttpCode, Post } from "@nestjs/common";
import {
  recordHealthConsentRequestSchema,
  type RecordHealthConsentRequest,
} from "@foodscanner/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AccountService } from "./account.service";
import type { RequestUser } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";

@Controller("me")
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  me(@CurrentUser() user: RequestUser) {
    return this.accounts.me(user.userId);
  }

  /** "I agree" on the health-info notice (design 0b). */
  @Post("health-consent")
  recordHealthConsent(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(recordHealthConsentRequestSchema))
    body: RecordHealthConsentRequest
  ) {
    return this.accounts.recordHealthConsent(user.userId, body.notice_version);
  }

  /** In-app account deletion (App Store 5.1.1(v), Google Play policy). */
  @Delete()
  @HttpCode(204)
  async delete(@CurrentUser() user: RequestUser): Promise<void> {
    await this.accounts.delete(user.userId);
  }
}
