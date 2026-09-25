import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CreateSubmissionResponse,
  SubmissionStatusResponse,
} from "@foodscanner/shared";
import { createHash } from "node:crypto";
import { Model } from "mongoose";
import { ExtractionQueueService } from "../common/extraction-queue.service";
import { ObjectStorageService } from "../common/object-storage.service";
import {
  Submission,
  SubmissionDocument,
} from "../database/schemas/submission.schema";

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>,
    private readonly storage: ObjectStorageService,
    private readonly queue: ExtractionQueueService,
  ) {}

  async create(
    barcode: string,
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string } | undefined,
  ): Promise<CreateSubmissionResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("photo file is required");
    }

    const photoHash = createHash("sha256").update(file.buffer).digest("hex");
    const existing = await this.submissions
      .findOne({ barcode, photo_hash: photoHash })
      .exec();
    if (existing) {
      return { submission_id: existing.id as string };
    }

    const photoKey = `labels/${barcode}/${photoHash}${extension(file.originalname)}`;
    await this.storage.putLabelPhoto(photoKey, file.buffer, file.mimetype);

    try {
      const created = await this.submissions.create({
        barcode,
        photo_hash: photoHash,
        photo_key: photoKey,
        user_id: userId,
        status: "processing",
        product_version_id: null,
      });
      await this.queue.enqueueExtraction(created.id as string);
      return { submission_id: created.id as string };
    } catch (error) {
      if (isDuplicateKey(error)) {
        const dup = await this.submissions
          .findOne({ barcode, photo_hash: photoHash })
          .exec();
        if (dup) {
          return { submission_id: dup.id as string };
        }
      }
      throw error;
    }
  }

  async getStatus(id: string): Promise<SubmissionStatusResponse> {
    const submission = await this.submissions.findById(id).exec();
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }
    return {
      status: submission.status,
      product_version_id: submission.product_version_id
        ? String(submission.product_version_id)
        : undefined,
    };
  }
}

function extension(filename: string): string {
  const match = filename.match(/\.[a-zA-Z0-9]+$/);
  return match ? match[0] : "";
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}
