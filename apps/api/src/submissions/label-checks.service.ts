import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { LabelCheckResponse, ProductSummary } from "@foodscanner/shared";
import { Model, Types } from "mongoose";
import { ObjectStorageService } from "../common/object-storage.service";
import { Scan, ScanDocument } from "../database/schemas/scan.schema";
import {
  type LabelFacts,
  Submission,
  SubmissionDocument,
} from "../database/schemas/submission.schema";
import { HouseholdVerdictService } from "../personalization/household-verdict.service";
import { ProductSummaryService } from "../product-versions/product-summary";

type ReadyLabelCheck = SubmissionDocument & { label_facts: LabelFacts };

/**
 * Label checks: packs with no barcode, read from one person's photos for
 * them alone (design 2d). Stored on the submission, never as a product.
 */
@Injectable()
export class LabelChecksService {
  private readonly logger = new Logger(LabelChecksService.name);

  constructor(
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>,
    @InjectModel(Scan.name) private readonly scans: Model<ScanDocument>,
    private readonly householdVerdicts: HouseholdVerdictService,
    private readonly storage: ObjectStorageService,
    private readonly productSummaries: ProductSummaryService
  ) {}

  /**
   * Erases one of this user's label checks for good: its photos, what was
   * read, and its Recent scans entries. It was never in the catalog, so
   * nothing else refers to it.
   */
  async delete(id: Types.ObjectId, userId: string): Promise<void> {
    const check = await this.submissions
      .findOne({ _id: id, barcode: null, user_id: userId })
      .exec();
    await this.scans.deleteMany({ user_id: userId, label_check_id: id }).exec();
    if (!check) {
      return;
    }
    // The record first: a failure part-way leaves stray photos, never a
    // check whose photos are gone.
    await this.submissions.deleteOne({ _id: check._id }).exec();
    await Promise.all(
      check.photo_keys.map((key) =>
        this.storage.deleteLabelPhoto(key).catch((error: unknown) => {
          this.logger.warn(`photo delete failed key=${key}: ${String(error)}`);
        })
      )
    );
  }

  /** Today's verdicts for the family; only its owner can open it, once read. */
  async verdict(id: string, userId: string): Promise<LabelCheckResponse> {
    const check = await this.findReady(id, userId);
    return (
      await this.householdVerdicts.forLabelCheck(
        check.id as string,
        check.label_facts,
        userId
      )
    ).response;
  }

  /** How each of this user's read checks shows in Recent scans, by id. */
  async summaries(
    ids: Types.ObjectId[],
    userId: string
  ): Promise<Map<string, ProductSummary>> {
    const checks = ids.length
      ? await this.submissions
          .find({
            _id: { $in: ids },
            barcode: null,
            user_id: new Types.ObjectId(userId),
            label_facts: { $ne: null },
          })
          .exec()
      : [];
    return new Map(
      checks.map((check) => [
        check.id as string,
        this.productSummaries.summarizeLabelCheck(
          check.id as string,
          check.label_facts!
        ),
      ])
    );
  }

  async findReady(id: string, userId: string): Promise<ReadyLabelCheck> {
    const check = Types.ObjectId.isValid(id)
      ? await this.submissions.findById(id).exec()
      : null;
    if (
      !check ||
      check.barcode !== null ||
      String(check.user_id) !== userId ||
      check.status !== "ready" ||
      !check.label_facts
    ) {
      throw new NotFoundException("Label check not found");
    }
    return check as ReadyLabelCheck;
  }
}
