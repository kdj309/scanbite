import "reflect-metadata";
/**
 * Repairs nutrition stored before off-mapper's current checks existed, then
 * drops the affected scoring records and cached verdicts so they're
 * recomputed:
 *  1. Drinks stored as solids — the pack size says ml/l but values sit
 *     under *_per_100g (OFF reports drinks per 100 ml, so only the keys
 *     are wrong). Solid limits applied and drink rules were skipped.
 *  2. Physically impossible values (e.g. OFF sodium typed in mg into a
 *     grams field, stored 1000x too high) are removed, so the verdict says
 *     "couldn't check" instead of flagging on a wrong number.
 *
 * Dry run by default; pass --apply to write. Safe to re-run.
 *
 *   pnpm build && node dist/admin/repair-nutrition.js [--apply]
 */
import { ConfigService } from "@nestjs/config";
import { verdictCacheKeyPattern } from "@foodscanner/shared";
import mongoose from "mongoose";
import { RedisCacheService } from "../common/redis-cache.service";
import {
  ProductVersion,
  ProductVersionSchema,
} from "../database/schemas/product-version.schema";
import {
  ScoringRecord,
  ScoringRecordSchema,
} from "../database/schemas/scoring-record.schema";
import { NUTRITION_FIELDS, repairNutrition } from "../off/nutrition-repair";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(MONGO_URI);
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const scoringRecords = mongoose.model(
    ScoringRecord.name,
    ScoringRecordSchema
  );
  const redis = new RedisCacheService(
    new ConfigService({ REDIS_URL }) as never
  );

  const candidates = await versions
    .find(
      {
        $or: Object.keys(NUTRITION_FIELDS).map((key) => ({
          [`nutrition.${key}`]: { $exists: true },
        })),
      },
      { barcode: 1, name: 1, quantity: 1, nutrition: 1 }
    )
    .lean();

  let repaired = 0;
  for (const version of candidates) {
    const before = version.nutrition ?? {};
    const after = repairNutrition(before, version.quantity);
    if (JSON.stringify(after) === JSON.stringify(before)) {
      continue;
    }
    repaired += 1;
    console.log(
      `${version.barcode}  ${version.name} (${version.quantity ?? "?"}): ` +
        `${JSON.stringify(before)} -> ${JSON.stringify(after)}`
    );
    if (APPLY) {
      await versions.updateOne(
        { _id: version._id },
        { $set: { nutrition: after } }
      );
      await scoringRecords.deleteMany({ product_version_id: version._id });
      await redis.deleteByPattern(
        verdictCacheKeyPattern(version.barcode, String(version._id))
      );
    }
  }

  console.log(
    `\n${repaired} of ${candidates.length} product versions needed repair` +
      (APPLY ? " — repaired." : " (dry run; pass --apply to repair).")
  );
  await redis.client.quit();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
