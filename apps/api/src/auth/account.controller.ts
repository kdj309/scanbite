import { Controller, Delete, Get, HttpCode } from "@nestjs/common";
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

  /** In-app account deletion (App Store 5.1.1(v), Google Play policy). */
  @Delete()
  @HttpCode(204)
  async delete(@CurrentUser() user: RequestUser): Promise<void> {
    await this.accounts.delete(user.userId);
  }
}
