import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { memoryStorage } from "multer";
import { SubmissionsService } from "./submissions.service";

@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post("products/:barcode/submissions")
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  create(
    @CurrentUser() user: RequestUser,
    @Param("barcode") barcode: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.submissions.create(barcode, user.userId, file);
  }

  @Get("submissions/:id")
  getStatus(@Param("id") id: string) {
    return this.submissions.getStatus(id);
  }
}
