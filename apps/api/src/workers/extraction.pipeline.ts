import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { UnrecoverableError } from "bullmq";
import { Model, Types } from "mongoose";
import { AliasService } from "../alias/alias.service";
import { isDuplicateKeyError } from "../common/mongo-errors";
import type { PromoteResult } from "../consensus/consensus.service";
import {
  planAfterExtraction,
  type VersionSnapshot,
} from "../consensus/conflict";
import { Product, ProductDocument } from "../database/schemas/product.schema";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import {
  Submission,
  SubmissionDocument,
} from "../database/schemas/submission.schema";
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
    @InjectModel(Product.name)
    private readonly products: Model<ProductDocument>,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    @Inject(VISION_PORT) private readonly vision: VisionPort,
    private readonly alias: AliasService,
    private readonly scoring: ScoringService,
    private readonly queues: JobQueuesService
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
      barcode: submission.barcode,
      photoKey: submission.photo_key,
    });
    const ingredients = await this.resolveIngredients(extracted.ingredients);
    const product = await this.findOrCreateProduct(submission.barcode);
    const live = await this.versions
      .findOne({ barcode: submission.barcode, status: "live" })
      .exec();

    const plan = planAfterExtraction({
      live: live ? snapshotFromVersion(live) : null,
      incoming: snapshotFromIncoming(extracted, ingredients),
    });

    if (plan.kind === "reuse_live" && live) {
      await this.scoring.ensureScoringRecord(live);
      await this.finishSubmission(submission, {
        status: "ready",
        productVersionId: live._id as Types.ObjectId,
        event: "ready",
      });
      return;
    }

    const pending = await this.versions.create({
      product_id: product._id,
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
      status: "pending",
    });
    await this.scoring.ensureScoringRecord(pending);
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

  private async resolveIngredients(raws: string[]): Promise<
    Array<{
      raw: string;
      canonical_id: Types.ObjectId | null;
      status: "resolved" | "unresolved";
    }>
  > {
    const resolved = await Promise.all(
      raws.map((raw) => this.alias.resolveRaw(raw))
    );
    return raws.map((raw, index) => ({
      raw,
      canonical_id: resolved[index].canonical_id
        ? new Types.ObjectId(resolved[index].canonical_id)
        : null,
      status: resolved[index].status,
    }));
  }

  private async findOrCreateProduct(barcode: string): Promise<ProductDocument> {
    const existing = await this.products.findOne({ barcode }).exec();
    if (existing) {
      return existing;
    }
    try {
      return await this.products.create({ barcode });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const raced = await this.products.findOne({ barcode }).exec();
      if (!raced) {
        throw error;
      }
      return raced;
    }
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
// "superseded"/"already_live" mean a live version already exists, just from
// a different submission, so this one's outcome is "ready", not stuck pending.
function statusForPromoteResult(
  result: PromoteResult
): "ready" | "needs_review" {
  if (result.promoted || result.reason !== "needs_review") {
    return "ready";
  }
  return "needs_review";
}

type ResolvedIngredient = {
  raw: string;
  canonical_id: Types.ObjectId | null;
};

function ingredientSetsFromRows(ingredients: ResolvedIngredient[]): {
  resolvedCanonicalIds: string[];
  unresolvedRaw: string[];
} {
  const resolvedCanonicalIds: string[] = [];
  const unresolvedRaw: string[] = [];
  for (const ingredient of ingredients) {
    if (ingredient.canonical_id) {
      resolvedCanonicalIds.push(String(ingredient.canonical_id));
    } else {
      unresolvedRaw.push(ingredient.raw);
    }
  }
  return { resolvedCanonicalIds, unresolvedRaw };
}

function snapshotFromVersion(version: ProductVersionDocument): VersionSnapshot {
  return {
    name: version.name,
    brand: version.brand,
    nutrition: version.nutrition ?? {},
    ...ingredientSetsFromRows(version.ingredients),
    extraction_confidence: version.extraction_confidence ?? 0,
  };
}

function snapshotFromIncoming(
  extracted: ExtractionOutput,
  ingredients: ResolvedIngredient[]
): VersionSnapshot {
  return {
    name: extracted.name,
    brand: extracted.brand,
    nutrition: extracted.nutrition,
    ...ingredientSetsFromRows(ingredients),
    extraction_confidence: extracted.extraction_confidence,
  };
}
