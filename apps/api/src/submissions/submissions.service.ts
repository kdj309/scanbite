import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CreateSubmissionResponse,
  SubmissionStatusResponse,
} from "@foodscanner/shared";
import { createHash } from "node:crypto";
import { Model } from "mongoose";
import { isDuplicateKeyError } from "../common/mongo-errors";
import { ObjectStorageService } from "../common/object-storage.service";
import {
  Submission,
  SubmissionDocument,
} from "../database/schemas/submission.schema";
import { JobQueuesService } from "../workers/job-queues.service";

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>,
    private readonly storage: ObjectStorageService,
    private readonly queues: JobQueuesService
  ) {}

  async create(
    barcode: string,
    userId: string,
    files:
      | Array<{ buffer: Buffer; mimetype: string; originalname: string }>
      | undefined
  ): Promise<CreateSubmissionResponse> {
    if (!files?.length) {
      throw new BadRequestException("at least one photo is required");
    }

    const photoHashes = files.map((file) =>
      createHash("sha256").update(file.buffer).digest("hex")
    );
    // Order-independent so the same photos uploaded in a different order still dedup.
    const setHash = createHash("sha256")
      .update([...photoHashes].sort().join(":"))
      .digest("hex");

    const existing = await this.submissions
      .findOne({ barcode, photo_hash: setHash })
      .exec();
    if (existing) {
      return { submission_id: existing.id as string };
    }

    const photoKeys = files.map(
      (file, index) =>
        `labels/${barcode}/${setHash}/${photoHashes[index]}${extension(file.originalname)}`
    );
    await Promise.all(
      files.map((file, index) =>
        this.storage.putLabelPhoto(photoKeys[index], file.buffer, file.mimetype)
      )
    );

    let created: SubmissionDocument;
    try {
      created = await this.submissions.create({
        barcode,
        photo_hash: setHash,
        photo_keys: photoKeys,
        user_id: userId,
        status: "processing",
        product_version_id: null,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const dup = await this.submissions
          .findOne({ barcode, photo_hash: setHash })
          .exec();
        if (dup) {
          return { submission_id: dup.id as string };
        }
      }
      throw error;
    }

    try {
      await this.queues.enqueueExtraction(created.id as string);
    } catch (error) {
      // Without its job a submission would stay "processing" forever, and
      // the duplicate check above would hand it back on every retry. Undo
      // it so the user's retry starts fresh. (The unique barcode+photo-set
      // index means these photos belong to this submission alone.)
      await this.discard(created).catch((cleanupError: Error) =>
        this.logger.error(
          `could not undo submission ${created.id as string}: ${cleanupError.message}`
        )
      );
      throw error;
    }
    return { submission_id: created.id as string };
  }

  private async discard(submission: SubmissionDocument): Promise<void> {
    await this.submissions.deleteOne({ _id: submission._id }).exec();
    await Promise.all(
      submission.photo_keys.map((key) => this.storage.deleteLabelPhoto(key))
    );
  }

  async getStatus(
    id: string,
    userId: string
  ): Promise<SubmissionStatusResponse> {
    const submission = await this.submissions.findById(id).exec();
    if (!submission || String(submission.user_id) !== userId) {
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
