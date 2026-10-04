import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { MAX_SUBMISSION_PHOTOS } from "@foodscanner/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { memoryStorage } from "multer";
import { SubmissionsService } from "./submissions.service";

@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  // Tighter than the global default — each submission eventually triggers
  // a real paid Gemini/Claude call once it reaches the extraction worker
  // (not synchronously here, but this is the only entry point to it), so
  // this caps worst-case vision-LLM cost from one account, not just
  // request volume. Tracked by user id (AppThrottlerGuard), not IP.
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post("products/:barcode/submissions")
  @HttpCode(202)
  @UseInterceptors(
    FilesInterceptor("photos", MAX_SUBMISSION_PHOTOS, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  create(
    @CurrentUser() user: RequestUser,
    @Param("barcode") barcode: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.submissions.create(barcode, user.userId, files);
  }

  @Get("submissions/:id")
  getStatus(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.submissions.getStatus(id, user.userId);
  }
}
