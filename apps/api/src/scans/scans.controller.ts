import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  createScanRequestSchema,
  listScansQuerySchema,
  memberSummaryQuerySchema,
  type CreateScanRequest,
  type ListScansQuery,
  type MemberSummaryQuery,
} from "@foodscanner/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ScansService } from "./scans.service";

@Controller()
export class ScansController {
  constructor(private readonly scans: ScansService) {}

  @Post("scans")
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createScanRequestSchema)) body: CreateScanRequest,
  ) {
    return this.scans.create(user, body);
  }

  @Get("household-members/:id/scans")
  list(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(listScansQuerySchema)) query: ListScansQuery,
  ) {
    return this.scans.list(user, id, query);
  }

  @Get("household-members/:id/summary")
  summary(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(memberSummaryQuerySchema))
    query: MemberSummaryQuery,
  ) {
    return this.scans.summary(user, id, query);
  }
}
