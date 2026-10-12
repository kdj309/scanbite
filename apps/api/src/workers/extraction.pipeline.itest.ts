/**
 * "Read by AI · verifying" end to end against real Mongo + Redis: the
 * extraction pipeline records who sent the photos, and a product read from
 * photos is confirmed only when someone ELSE's photos match it. The vision
 * model is faked; queues are captured instead of run.
 *
 *   pnpm --filter api build && pnpm --filter api test:integration
 */
import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import mongoose, { Types } from "mongoose";
import {
  TEST_REDIS_URL,
  connectTestDb,
  dropTestDb,
} from "../common/integration-db";
import { RedisCacheService } from "../common/redis-cache.service";
import { VerdictCacheService } from "../common/verdict-cache.service";
import { ConsensusService } from "../consensus/consensus.service";
import {
  Ingredient,
  IngredientSchema,
} from "../database/schemas/ingredient.schema";
import {
  ProductVersion,
  ProductVersionSchema,
} from "../database/schemas/product-version.schema";
import { Product, ProductSchema } from "../database/schemas/product.schema";
import { RuleSet, RuleSetSchema } from "../database/schemas/rule-set.schema";
import {
  ScoringRecord,
  ScoringRecordSchema,
} from "../database/schemas/scoring-record.schema";
import {
  Submission,
  SubmissionSchema,
} from "../database/schemas/submission.schema";
import { productSummary } from "../product-versions/product-summary";
import { ProductVersionIngestionService } from "../product-versions/product-version-ingestion.service";
import { ScoringService } from "../scoring/scoring.service";
import { HLD_RULE_SET_SEED } from "./seed/hld-seed";
import { ExtractionPipeline } from "./extraction.pipeline";
import type { ExtractionOutput } from "./vision/extraction-output";

/** Every photo set reads as the same product, so submissions match. */
const READ: ExtractionOutput = {
  name: "Homemade-style namkeen",
  brand: "Local",
  category: "snacks",
  ingredients: ["gram flour", "salt"],
  nutrition: { sugar_per_100g: 2 },
  extraction_confidence: 0.9,
  photo_consistency: "consistent",
};

describe("verifying photo-read products (integration)", () => {
  const config = new ConfigService({
    REDIS_URL: TEST_REDIS_URL,
    VERDICT_CACHE_TTL_SECONDS: 60,
  });
  const redis = new RedisCacheService(config as never);
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const productModel = mongoose.model(Product.name, ProductSchema);
  const submissions = mongoose.model(Submission.name, SubmissionSchema);
  const scoring = new ScoringService(
    mongoose.model(RuleSet.name, RuleSetSchema) as never,
    mongoose.model(ScoringRecord.name, ScoringRecordSchema) as never,
    mongoose.model(Ingredient.name, IngredientSchema) as never,
    new VerdictCacheService(redis, config as never)
  );
  const consensus = new ConsensusService(
    mongoose.connection,
    versions as never,
    productModel as never
  );
  const queued: string[] = [];
  const pipeline = new ExtractionPipeline(
    submissions as never,
    versions as never,
    { extract: async () => READ },
    new ProductVersionIngestionService(
      productModel as never,
      versions as never,
      {
        resolveRaw: async () => ({ status: "unresolved", canonical_id: null }),
      } as never,
      scoring
    ),
    scoring,
    {
      enqueuePromote: async (job: { productVersionId: string }) => {
        queued.push(job.productVersionId);
      },
      enqueueNotification: async () => undefined,
    } as never
  );

  let seq = 0;
  /** One user's photos of `barcode`, run through the worker. */
  async function submitPhotos(barcode: string, userId: Types.ObjectId) {
    const submission = await submissions.create({
      barcode,
      photo_hash: `hash-${seq++}`,
      photo_keys: [`labels/${seq}.jpg`],
      user_id: userId,
    });
    await pipeline.processSubmission(submission.id as string);
    // Stand in for the promote worker: the first version of a barcode goes live.
    for (const id of queued.splice(0)) {
      await consensus.promoteIfEligible(id);
    }
  }

  const liveSummary = async (barcode: string) =>
    productSummary(
      (await versions.findOne({ barcode, status: "live" }).exec())!
    );

  before(async () => {
    await connectTestDb("foodscanner_test_pipeline");
    await mongoose.model(RuleSet.name).create(HLD_RULE_SET_SEED);
  });

  after(async () => {
    await dropTestDb();
    await redis.client.quit();
  });

  it("records who sent the photos and starts out verifying", async () => {
    const sender = new Types.ObjectId();
    await submitPhotos("8920000000001", sender);
    const live = await versions
      .findOne({ barcode: "8920000000001", status: "live" })
      .exec();
    assert.ok(live?.submitted_by?.equals(sender));
    const summary = await liveSummary("8920000000001");
    assert.deepEqual([summary.source, summary.verifying], ["ai_photos", true]);
  });

  it("is confirmed when someone else's photos match", async () => {
    await submitPhotos("8920000000002", new Types.ObjectId());
    await submitPhotos("8920000000002", new Types.ObjectId());
    assert.equal((await liveSummary("8920000000002")).verifying, false);
  });

  it("is not confirmed by the same person sending photos again", async () => {
    const sender = new Types.ObjectId();
    await submitPhotos("8920000000003", sender);
    await submitPhotos("8920000000003", sender);
    assert.equal((await liveSummary("8920000000003")).verifying, true);
  });
});
