import "reflect-metadata";
/**
 * Pre-launch cold-start mitigation (see product-strategy brainstorm,
 * 2026-10-01): seeds the ~20 common Indian packaged products already
 * curated for docs/research/vision-eval/ground-truth.json as real, live
 * ProductVersion rows. A new user's very first scan is disproportionately
 * likely to be one of these high-frequency products — resolving them
 * instantly off our own DB avoids the worst version of OFF's thin India
 * coverage (~0.25% of its global catalog) before any real submission
 * volume exists.
 *
 * This is NOT the same as the "off" source — that's reserved for a live,
 * completeness-tag-scored OFF API fetch (see off-lookup.service.ts). This
 * is a one-time, manually curated snapshot, tagged "manual_seed" to keep
 * provenance honest. Confidence is fixed, not computed via
 * offExtractionConfidence, because that heuristic is calibrated for OFF's
 * live states_tags/data_quality_errors_tags signals, which this ground-
 * truth export doesn't carry.
 *
 * Idempotent — safe to re-run; skips any barcode that already has a live
 * version.
 *
 * Prerequisite: an active rule_set must already exist (ensureScoringRecord
 * throws otherwise) — run the dev seed or create one first if this is a
 * fresh environment.
 *
 *   pnpm exec tsc -p tsconfig.json && node dist/admin/seed-common-products.js
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import mongoose, { Types } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { validateEnv } from "../config/env";
import { RedisCacheService } from "../common/redis-cache.service";
import { VerdictCacheService } from "../common/verdict-cache.service";
import {
  EmbeddingAliasLayer,
  ExactAliasLayer,
  SimilarityAliasLayer,
} from "../alias/alias-layers";
import { AliasService } from "../alias/alias.service";
import { isDuplicateKeyError } from "../common/mongo-errors";
import {
  Ingredient,
  IngredientSchema,
} from "../database/schemas/ingredient.schema";
import {
  IngredientAlias,
  IngredientAliasSchema,
} from "../database/schemas/ingredient-alias.schema";
import { Product, ProductSchema } from "../database/schemas/product.schema";
import {
  ProductVersion,
  ProductVersionSchema,
} from "../database/schemas/product-version.schema";
import { RuleSet, RuleSetSchema } from "../database/schemas/rule-set.schema";
import {
  ScoringRecord,
  ScoringRecordSchema,
} from "../database/schemas/scoring-record.schema";
import {
  UnresolvedTerm,
  UnresolvedTermSchema,
} from "../database/schemas/unresolved-term.schema";
import { ScoringService } from "../scoring/scoring.service";
import { mapOffProduct } from "../off/off-mapper";
import type { OffProductPayload } from "../off/off-extraction";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";

/** Manually curated, pre-launch data — not a live OFF completeness score. */
const SEED_CONFIDENCE = 0.92;

type GroundTruthEntry = {
  code: string;
  product_name: string;
  brands?: string;
  categories_tags?: string[];
  ingredients_text_off?: string;
  nutriments_off?: Record<string, number | string | undefined>;
  nova_group_off?: number | null;
  additives_n_off?: number | null;
};

function readableCategory(tags: string[] | undefined): string | undefined {
  const first = tags?.[0];
  if (!first) {
    return undefined;
  }
  return first
    .replace(/^en:/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toOffProduct(
  entry: GroundTruthEntry
): NonNullable<OffProductPayload["product"]> {
  return {
    product_name: entry.product_name,
    brands: entry.brands,
    categories: readableCategory(entry.categories_tags),
    categories_tags: entry.categories_tags,
    ingredients_text: entry.ingredients_text_off,
    nutriments: entry.nutriments_off,
    nova_group: entry.nova_group_off ?? undefined,
    additives_n: entry.additives_n_off ?? undefined,
  };
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const env = validateEnv(process.env);
  const config = new ConfigService(env);

  const products = mongoose.model(Product.name, ProductSchema);
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const ingredients = mongoose.model(Ingredient.name, IngredientSchema);
  const aliases = mongoose.model(IngredientAlias.name, IngredientAliasSchema);
  const unresolvedTerms = mongoose.model(
    UnresolvedTerm.name,
    UnresolvedTermSchema
  );
  const ruleSets = mongoose.model(RuleSet.name, RuleSetSchema);
  const scoringRecords = mongoose.model(
    ScoringRecord.name,
    ScoringRecordSchema
  );

  const redisCache = new RedisCacheService(config as any);
  const cache = new VerdictCacheService(redisCache, config as any);
  const scoring = new ScoringService(
    ruleSets as any,
    scoringRecords as any,
    ingredients as any,
    cache
  );
  const alias = new AliasService(
    new ExactAliasLayer(aliases as any, ingredients as any),
    new SimilarityAliasLayer(),
    new EmbeddingAliasLayer(),
    unresolvedTerms as any
  );

  const groundTruthPath = join(
    __dirname,
    "../../../../docs/research/vision-eval/ground-truth.json"
  );
  const entries: GroundTruthEntry[] = JSON.parse(
    readFileSync(groundTruthPath, "utf8")
  );

  let seeded = 0;
  let skipped = 0;

  for (const entry of entries) {
    const barcode = entry.code;
    const existing = await versions.findOne({ barcode, status: "live" }).exec();
    if (existing) {
      console.log(`skip ${barcode} (${entry.product_name}) — already live`);
      skipped += 1;
      continue;
    }

    const extracted = mapOffProduct(toOffProduct(entry));
    if (!extracted) {
      console.warn(
        `skip ${barcode} (${entry.product_name}) — no usable ingredients`
      );
      skipped += 1;
      continue;
    }

    const resolved = await Promise.all(
      extracted.ingredients.map((raw) => alias.resolveRaw(raw))
    );
    const ingredientRows = extracted.ingredients.map((raw, index) => ({
      raw,
      canonical_id: resolved[index].canonical_id
        ? new Types.ObjectId(resolved[index].canonical_id)
        : null,
      status: resolved[index].status,
    }));

    let product = await products.findOne({ barcode }).exec();
    if (!product) {
      try {
        product = await products.create({ barcode });
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
        product = await products.findOne({ barcode }).exec();
      }
    }
    if (!product) {
      throw new Error(`failed to find-or-create product for ${barcode}`);
    }

    const [version] = await versions.create([
      {
        product_id: product._id,
        barcode,
        name: extracted.name,
        brand: extracted.brand,
        category: extracted.category,
        ingredients: ingredientRows,
        nutrition: extracted.nutrition,
        nova_group: extracted.nova_group,
        additive_count: extracted.additive_count,
        extraction_confidence: SEED_CONFIDENCE,
        source: "manual_seed",
        status: "live",
      },
    ]);
    product.current_version_id = version._id as Types.ObjectId;
    await product.save();
    await scoring.ensureScoringRecord(version);

    console.log(`seeded ${barcode} — ${extracted.name} (${extracted.brand})`);
    seeded += 1;
  }

  console.log(
    `\nDone. Seeded ${seeded}, skipped ${skipped} (of ${entries.length}).`
  );
  await redisCache.client.quit();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
