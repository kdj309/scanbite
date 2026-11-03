import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { UnrecoverableError } from "bullmq";
import { Model, Types } from "mongoose";
import type { PromoteResult } from "../consensus/consensus.service";
import { planAfterExtraction } from "../consensus/conflict";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import {
  Submission,
  SubmissionDocument,
} from "../database/schemas/submission.schema";
import {
  ProductVersionIngestionService,
  type ResolvedIngredientRow,
} from "../product-versions/product-version-ingestion.service";
import { confirmsVersion } from "../product-versions/product-summary";
import {
  snapshotFromIncoming,
  snapshotFromVersion,
} from "../product-versions/product-version-snapshot";
import { ScansService } from "../scans/scans.service";
import { ScoringService } from "../scoring/scoring.service";
import { JobQueuesService } from "./job-queues.service";
import type { ExtractionOutput } from "./vision/extraction-output";
import { VISION_PORT, type VisionPort } from "./vision/vision.port";

@Injectable()
export class ExtractionPipeline {
  private readonly logger = new Logger(ExtractionPipeline.name);

  constructor(
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    @Inject(VISION_PORT) private readonly vision: VisionPort,
    private readonly ingestion: ProductVersionIngestionService,
    private readonly scoring: ScoringService,
    private readonly queues: JobQueuesService,
    private readonly scans: ScansService
  ) {}

  async processSubmission(submissionId: string): Promise<void> {
    const submission = await this.submissions.findById(submissionId).exec();
    if (!submission) {
      throw new UnrecoverableError(`Submission ${submissionId} not found`);
    }
    if (submission.status === "ready" || submission.status === "needs_review") {
      return;
    }

    const extracted = await this.vision.extract({
      barcode: submission.barcode ?? `label check ${submissionId}`,
      photoKeys: submission.photo_keys,
    });
    const ingredients = await this.ingestion.resolveIngredients(
      extracted.ingredients
    );

    if (submission.barcode === null) {
      await this.finishLabelCheck(submission, extracted, ingredients);
      return;
    }

    if (extracted.photo_consistency === "inconsistent") {
      // Confidently-extracted data from a mismatched photo set is worse than
      // low confidence on one product — always send to review, never promote.
      const pending = await this.ingestion.createPendingVersion({
        barcode: submission.barcode,
        name: extracted.name,
        brand: extracted.brand,
        category: extracted.category,
        ingredients,
        nutrition: extracted.nutrition,
        nova_group: extracted.nova_group,
        additive_count: extracted.additive_count,
        extraction_confidence: extracted.extraction_confidence,
        source: "user_submission",
        submitted_by: submission.user_id,
      });
      await this.finishSubmission(submission, {
        status: "needs_review",
        productVersionId: pending._id as Types.ObjectId,
        event: "needs_review",
      });
      this.logger.log(
        `Submission ${submissionId} flagged needs_review: photos were inconsistent`
      );
      return;
    }

    const live = await this.versions
      .findOne({ barcode: submission.barcode, status: "live" })
      .exec();

    const plan = planAfterExtraction({
      live: live ? snapshotFromVersion(live) : null,
      incoming: snapshotFromIncoming(extracted, ingredients),
    });

    if (plan.kind === "reuse_live" && live) {
      if (confirmsVersion(live, submission.user_id)) {
        // Conditional, so two matching submissions processed at once can't
        // both confirm, and the first confirmation time is kept.
        await this.versions.updateOne(
          { _id: live._id, confirmed_at: null },
          { $set: { confirmed_at: new Date() } }
        );
      }
      await this.scoring.ensureScoringRecord(live);
      await this.finishSubmission(submission, {
        status: "ready",
        productVersionId: live._id as Types.ObjectId,
        event: "ready",
      });
      return;
    }

    const pending = await this.ingestion.createPendingVersion({
      barcode: submission.barcode,
      name: extracted.name,
      brand: extracted.brand,
      category: extracted.category,
      ingredients,
      nutrition: extracted.nutrition,
      nova_group: extracted.nova_group,
      additive_count: extracted.additive_count,
      extraction_confidence: extracted.extraction_confidence,
      source: "user_submission",
      submitted_by: submission.user_id,
    });
    submission.product_version_id = pending._id as Types.ObjectId;
    await submission.save();
    await this.queues.enqueuePromote({
      productVersionId: pending.id as string,
      submissionId: submission.id as string,
    });
    this.logger.log(
      `Queued promote for submission ${submissionId} version ${pending.id as string}`
    );
  }

  /**
   * A pack with no barcode: what the photos said stays on the submission,
   * for this person alone — no product version, so nothing reaches the
   * catalog. Its Recent scans entry is made here, not by the app, so it's
   * there even if the app was closed while reading. Photos of two
   * different packs can't be checked as one, and there's no review for a
   * private check, so that's a failed read.
   */
  private async finishLabelCheck(
    submission: SubmissionDocument,
    extracted: ExtractionOutput,
    ingredients: ResolvedIngredientRow[]
  ): Promise<void> {
    if (extracted.photo_consistency === "inconsistent") {
      await this.finishSubmission(submission, {
        status: "failed",
        event: "failed",
      });
      return;
    }
    const label_facts = {
      name: extracted.name,
      brand: extracted.brand,
      category: extracted.category,
      ingredients,
      nutrition: extracted.nutrition,
      nova_group: extracted.nova_group,
      additive_count: extracted.additive_count,
    };
    submission.label_facts = label_facts;
    // Before it's marked ready: a failure here retries the whole job,
    // where a ready submission would be skipped.
    await this.scans.recordLabelCheck(
      Object.assign(submission, { label_facts })
    );
    await this.finishSubmission(submission, {
      status: "ready",
      event: "ready",
    });
  }

  private async finishSubmission(
    submission: SubmissionDocument,
    input: {
      status: "ready" | "needs_review" | "failed";
      productVersionId?: Types.ObjectId;
      event: "ready" | "needs_review" | "failed";
    }
  ): Promise<void> {
    submission.status = input.status;
    if (input.productVersionId) {
      submission.product_version_id = input.productVersionId;
    }
    await submission.save();
    await this.queues.enqueueNotification({
      userId: String(submission.user_id),
      submissionId: submission.id as string,
      event: input.event,
    });
  }
}

export async function applyPromoteResult(input: {
  submissionId: string;
  result: PromoteResult;
  submissions: Model<SubmissionDocument>;
  queues: JobQueuesService;
}): Promise<void> {
  const submission = await input.submissions
    .findById(input.submissionId)
    .exec();
  if (!submission) {
    throw new UnrecoverableError(`Submission ${input.submissionId} not found`);
  }
  const status = statusForPromoteResult(input.result);
  submission.status = status;
  await submission.save();
  await input.queues.enqueueNotification({
    userId: String(submission.user_id),
    submissionId: submission.id as string,
    event: status,
  });
}

// Only a genuinely pending-review version should surface as "needs_review" —
// "superseded" means a live version already exists, just from
// a different submission, so this one's outcome is "ready", not stuck pending.
function statusForPromoteResult(
  result: PromoteResult
): "ready" | "needs_review" {
  if (result.promoted || result.reason !== "needs_review") {
    return "ready";
  }
  return "needs_review";
}
