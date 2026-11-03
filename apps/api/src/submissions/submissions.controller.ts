import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import {
  MAX_SUBMISSION_PHOTOS,
  barcodeSchema,
  createLabelCheckQuerySchema,
  type CreateLabelCheckQuery,
} from "@foodscanner/shared";
import { HouseholdService } from "../household/household.service";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { memoryStorage } from "multer";
import { LabelChecksService } from "./label-checks.service";
import { SubmissionsService } from "./submissions.service";

const photoUpload = FilesInterceptor("photos", MAX_SUBMISSION_PHOTOS, {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

@Controller()
export class SubmissionsController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly labelChecks: LabelChecksService,
    private readonly household: HouseholdService
  ) {}

  // Tighter than the global default — each submission eventually triggers
  // a real paid Gemini/Claude call once it reaches the extraction worker
  // (not synchronously here, but this is the only entry point to it), so
  // this caps worst-case vision-LLM cost from one account, not just
  // request volume. Tracked by user id (AppThrottlerGuard), not IP.
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post("products/:barcode/submissions")
  @HttpCode(202)
  @UseInterceptors(photoUpload)
  create(
    @CurrentUser() user: RequestUser,
    @Param("barcode", new ZodValidationPipe(barcodeSchema)) barcode: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.submissions.create(barcode, user.userId, files);
  }

  /** A pack with no barcode: read for this user only, never the catalog.
   *  Its own 5 per 10 min (the throttler counts each route apart) — the
   *  same paid read. Follow it with GET /submissions/:id, then open it
   *  with GET /label-checks/:id; its Recent scans entry is made when read. */
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post("label-checks")
  @HttpCode(202)
  @UseInterceptors(photoUpload)
  async createLabelCheck(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(createLabelCheckQuerySchema))
    query: CreateLabelCheckQuery,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const forMember = query.member_id
      ? await this.household.requireOwnedMember(user.userId, query.member_id)
      : null;
    return this.submissions.create(
      null,
      user.userId,
      files,
      forMember ? (forMember.id as string) : null
    );
  }

  @Get("label-checks/:id")
  getLabelCheck(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.labelChecks.verdict(id, user.userId);
  }

  @Get("submissions/:id")
  getStatus(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.submissions.getStatus(id, user.userId);
  }
}
