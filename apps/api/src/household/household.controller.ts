import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  createHouseholdMemberRequestSchema,
  updateHouseholdMemberRequestSchema,
  type CreateHouseholdMemberRequest,
  type UpdateHouseholdMemberRequest,
} from "@foodscanner/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { HouseholdService } from "./household.service";

@Controller("household-members")
export class HouseholdController {
  constructor(private readonly household: HouseholdService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.household.listForUser(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createHouseholdMemberRequestSchema))
    body: CreateHouseholdMemberRequest,
  ) {
    return this.household.createForUser(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateHouseholdMemberRequestSchema))
    body: UpdateHouseholdMemberRequest,
  ) {
    return this.household.updateForUser(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    await this.household.deleteForUser(user.userId, id);
  }
}
