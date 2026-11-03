import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { LabelCheckResponse, ProductSummary } from "@foodscanner/shared";
import { Model, Types } from "mongoose";
import {
  type LabelFacts,
  Submission,
  SubmissionDocument,
} from "../database/schemas/submission.schema";
import { HouseholdVerdictService } from "../personalization/household-verdict.service";
import { labelCheckSummary } from "../product-versions/product-summary";

type ReadyLabelCheck = SubmissionDocument & { label_facts: LabelFacts };

/**
 * Label checks: packs with no barcode, read from one person's photos for
 * them alone (design 2d). Stored on the submission, never as a product.
 */
@Injectable()
export class LabelChecksService {
  constructor(
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>,
    private readonly householdVerdicts: HouseholdVerdictService
  ) {}

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
        labelCheckSummary(check.id as string, check.label_facts!),
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
