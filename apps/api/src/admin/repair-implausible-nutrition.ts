import "reflect-metadata";
/**
 * One-off repair for nutrition values stored before off-mapper's physical
 * limits existed (e.g. OFF sodium typed in mg into a grams field, stored
 * 1000x too high). Removes each impossible value so the verdict says
 * "couldn't check" instead of flagging on a wrong number, then drops the
 * affected scoring records and cached verdicts so they're recomputed.
 *
 * Dry run by default; pass --apply to write. Safe to re-run.
 *
 *   pnpm build && node dist/admin/repair-implausible-nutrition.js [--apply]
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
import {
  isPlausibleGrams,
  type Nutrient,
  type ProductForm,
} from "../off/off-mapper";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const APPLY = process.argv.includes("--apply");

/** Stored field -> what it measures. Sodium is stored in mg. */
const FIELDS: Record<
  string,
  { nutrient: Nutrient; form: ProductForm; toGrams: number }
> = {
  sugar_per_100g: { nutrient: "sugar", form: "solid", toGrams: 1 },
  sugar_per_100ml: { nutrient: "sugar", form: "liquid", toGrams: 1 },
  sodium_per_100g: { nutrient: "sodium", form: "solid", toGrams: 1 / 1000 },
  sodium_per_100ml: { nutrient: "sodium", form: "liquid", toGrams: 1 / 1000 },
};

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

  const suspects = await versions
    .find({
      $or: Object.keys(FIELDS).map((field) => ({
        [`nutrition.${field}`]: { $exists: true },
      })),
    })
    .lean();

  let repaired = 0;
  for (const version of suspects) {
    const unset: Record<string, ""> = {};
    for (const [field, spec] of Object.entries(FIELDS)) {
      const value = version.nutrition?.[field];
      if (
        typeof value === "number" &&
        !isPlausibleGrams(spec.nutrient, spec.form, value * spec.toGrams)
      ) {
        unset[`nutrition.${field}`] = "";
        console.log(`${version.barcode}  ${version.name}: ${field}=${value}`);
      }
    }
    if (Object.keys(unset).length === 0) {
      continue;
    }
    repaired += 1;
    if (APPLY) {
      await versions.updateOne({ _id: version._id }, { $unset: unset });
      await scoringRecords.deleteMany({ product_version_id: version._id });
      await redis.deleteByPattern(
        verdictCacheKeyPattern(version.barcode, String(version._id))
      );
    }
  }

  console.log(
    `\n${repaired} of ${suspects.length} product versions had impossible values` +
      (APPLY ? " — repaired." : " (dry run; pass --apply to repair).")
  );
  await redis.client.quit();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
