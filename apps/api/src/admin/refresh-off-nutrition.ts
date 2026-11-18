import "reflect-metadata";
/**
 * Re-reads every live Open Food Facts product's nutrition with today's
 * mapper (all FSSAI label nutrients, physical limits, mg for sodium and
 * cholesterol) and replaces what's stored. Imports before 2026-11-17 kept
 * only sugar and sodium, and some values have since been corrected or
 * removed on OFF (Doritos 8901491001687: stored 11 mg sodium, OFF now has
 * no nutrition, which should read "couldn't check", not "low salt").
 *
 * Changed versions lose their scoring records and cached verdicts, so
 * they're scored again on the next read. Hand-curated seed products
 * (manual_seed) and photo-read ones are left alone. Paced under OFF's read
 * limit: ~1,900 barcodes take about 25 minutes. Safe to stop and re-run.
 *
 * Dry run by default (counts, no requests). --compare fetches and tallies
 * what would change without writing; --apply fetches and writes.
 * --limit=N takes the first N barcodes, --sample=N a random N, and
 * --only=<file> the barcodes listed in a file, one per line (to retry the
 * ones a run reported as failed).
 *
 *   pnpm build && node dist/admin/refresh-off-nutrition.js [--compare | --apply] [--sample=100]
 */
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { ConfigService } from "@nestjs/config";
import { verdictCacheKeyPattern, type Nutrition } from "@foodscanner/shared";
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
import { nutritionFromProduct } from "../off/off-mapper";
import { fetchOffProductWithRetry } from "../off/off-fetch";
import { OFF_LOOKUP_CACHE_PREFIX } from "../off/off-lookup.service";
import type { RefreshChange } from "./refresh-off-nutrition.types";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const APPLY = process.argv.includes("--apply");
const COMPARE = process.argv.includes("--compare");

/** A positive whole number from `--name=N`; undefined when not given. */
function countArg(name: string): number | undefined {
  const arg = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (arg === undefined) return undefined;
  const count = Number(arg.split("=")[1]);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`--${name} needs a positive whole number, got "${arg}"`);
  }
  return count;
}
const LIMIT = countArg("limit") ?? Infinity;
const SAMPLE = countArg("sample");
/** Barcodes from `--only=<file>`, one per line; undefined when not given. */
const ONLY = (() => {
  const arg = process.argv.find((value) => value.startsWith("--only="));
  if (arg === undefined) return undefined;
  return readFileSync(arg.slice("--only=".length), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
})();
/** ~75 reads a minute: under OFF's 100, with room for the API's own lookups. */
const REQUEST_GAP_MS = 800;
/** What nutritionFromProduct reads, including how it tells a drink. */
const FIELDS = "nutriments,product_quantity_unit,quantity,categories_tags";
/** The facts today's rules read: a change here can change a verdict. */
const VERDICT_FIELDS = /^(sugar|sodium)_per_100(g|ml)$/;

/**
 * Equal as the mapper stores values now (3 decimals): sodium stored before
 * rounding (0.11 g x 1000 = 110.00000000000001) is no real change from 110.
 */
function sameValue(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return Math.round(left * 1000) === Math.round(right * 1000);
  }
  return left === right;
}

function sameNutrition(before: Nutrition, after: Nutrition): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].every((key) => sameValue(before[key], after[key]));
}

/** "sodium_per_100g 11 -> missing" for each verdict fact that changed. */
function verdictChanges(before: Nutrition, after: Nutrition): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter(
      (key) => VERDICT_FIELDS.test(key) && !sameValue(before[key], after[key])
    )
    .map(
      (key) =>
        `${key} ${before[key] ?? "missing"} -> ${after[key] ?? "missing"}`
    );
}

/** The verdict nutrients a label gives, whatever its basis ("sugar", "sodium"). */
function verdictNutrients(nutrition: Nutrition): Set<string> {
  return new Set(
    Object.keys(nutrition)
      .filter((key) => VERDICT_FIELDS.test(key))
      .map((key) => key.replace(/_per_100(g|ml)$/, ""))
  );
}

function basisOf(nutrition: Nutrition): string | undefined {
  const keys = Object.keys(nutrition);
  if (keys.some((key) => key.endsWith("_per_100g"))) return "100 g";
  if (keys.some((key) => key.endsWith("_per_100ml"))) return "100 ml";
  return undefined;
}

/** The most important way the refreshed nutrition differs. */
function classify(before: Nutrition, after: Nutrition): RefreshChange {
  if (sameNutrition(before, after)) return "unchanged";
  const kept = verdictNutrients(after);
  const lost = [...verdictNutrients(before)].some((name) => !kept.has(name));
  if (lost) return "verdict_fact_lost";
  const was = basisOf(before);
  if (was !== undefined && was !== basisOf(after)) return "basis_changed";
  if (verdictChanges(before, after).length > 0) return "verdict_fact_changed";
  return "other_facts";
}

async function sampleBarcodes(
  versions: mongoose.Model<ProductVersion>,
  live: object
): Promise<string[]> {
  if (ONLY !== undefined) {
    const known = new Set(await versions.distinct("barcode", live));
    return ONLY.filter((barcode) => known.has(barcode));
  }
  if (SAMPLE !== undefined) {
    const picked = await versions.aggregate<{ _id: string }>([
      { $match: live },
      { $group: { _id: "$barcode" } },
      { $sample: { size: SAMPLE } },
    ]);
    return picked.map((row) => row._id);
  }
  return (await versions.distinct("barcode", live)).slice(0, LIMIT);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  // Only --apply deletes anything, so only it needs Redis.
  const redis = APPLY
    ? new RedisCacheService(new ConfigService({ REDIS_URL }) as never)
    : undefined;
  try {
    await refresh(redis);
  } finally {
    await redis?.client.quit();
    await mongoose.disconnect();
  }
}

/** Compares, or with Redis (--apply) writes, each barcode's fresh nutrition. */
async function refresh(redis: RedisCacheService | undefined) {
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const scoringRecords = mongoose.model(
    ScoringRecord.name,
    ScoringRecordSchema
  );
  const live = { source: "off", status: "live" };
  const barcodes = await sampleBarcodes(versions, live);

  if (!APPLY && !COMPARE) {
    console.log(
      `${barcodes.length} live OFF barcodes to refresh (dry run; pass --compare or --apply).`
    );
    return;
  }

  /** Drops a version's score and cached verdicts so its next read rescores. */
  const forgetScores = async (barcode: string, versionId: unknown) => {
    await scoringRecords.deleteMany({ product_version_id: versionId });
    await redis?.deleteByPattern(
      verdictCacheKeyPattern(barcode, String(versionId))
    );
  };

  const outcomes = { found: 0, not_on_off: 0, failed: 0 };
  const changes: Record<RefreshChange, number> = {
    verdict_fact_lost: 0,
    basis_changed: 0,
    verdict_fact_changed: 0,
    other_facts: 0,
    unchanged: 0,
  };
  for (const [index, barcode] of barcodes.entries()) {
    const result = await fetchOffProductWithRetry(barcode, FIELDS);
    outcomes[result.kind] += 1;
    if (result.kind === "failed") {
      console.warn(`${barcode}: failed (${result.reason}) — left for a re-run`);
    }
    if (result.kind === "found") {
      const after = nutritionFromProduct(result.product);
      const stored = await versions
        .find({ barcode, ...live }, { nutrition: 1, name: 1 })
        .lean();
      for (const version of stored) {
        const before = version.nutrition ?? {};
        const change = classify(before, after);
        changes[change] += 1;
        if (change === "unchanged") continue;
        const facts = verdictChanges(before, after);
        if (facts.length > 0) {
          console.log(
            `${change}  ${barcode}  ${version.name}: ${facts.join(", ")}`
          );
        }
        if (redis === undefined) continue; // --compare: report only
        // Before the write, so a run stopped right after it leaves no old
        // verdict behind (a re-run sees "unchanged" and skips it); after it,
        // so a verdict scored mid-write from the old values is dropped too.
        await forgetScores(barcode, version._id);
        await versions.updateOne(
          { _id: version._id },
          { $set: { nutrition: after } }
        );
        await forgetScores(barcode, version._id);
      }
    }
    if ((index + 1) % 50 === 0) {
      console.log(`${index + 1}/${barcodes.length}…`);
    }
    await sleep(REQUEST_GAP_MS);
  }

  // Lookups cached by the old mapper would bring its nutrition back.
  await redis?.deleteByPattern(`${OFF_LOOKUP_CACHE_PREFIX}:*`);

  console.log(`Done (${barcodes.length} barcodes):`, outcomes);
  console.log(redis ? "Versions:" : "Would change (nothing written):", changes);
  if (outcomes.failed) {
    console.log(`${outcomes.failed} failed — re-run to retry them.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
