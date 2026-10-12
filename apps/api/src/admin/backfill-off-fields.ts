import "reflect-metadata";
/**
 * Fills fields added to Open Food Facts imports after products were stored:
 * image_url, quantity, declared_allergens and declared_veg. Paced under OFF's read limit
 * (100 product reads/min), so ~1,900 barcodes take about 20 minutes. Only
 * empty fields are written; safe to stop and re-run.
 *
 * Dry run by default (counts, no requests); --apply to fetch and write;
 * --limit=N to try a few first.
 *
 *   pnpm build && node dist/admin/backfill-off-fields.js [--apply] [--limit=20]
 */
import { setTimeout as sleep } from "node:timers/promises";
import mongoose from "mongoose";
import { fetchWithTimeout } from "../common/fetch-with-timeout";
import {
  ProductVersion,
  ProductVersionSchema,
} from "../database/schemas/product-version.schema";
import type { OffProductPayload } from "../off/off-extraction";
import { OFF_USER_AGENT } from "../off/off-lookup.service";
import {
  declaredAllergens,
  declaredVeg,
  offImageUrl,
  offQuantity,
} from "../off/off-mapper";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";
const APPLY = process.argv.includes("--apply");
const LIMIT = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ??
    Infinity
);
// ~75 reads/min: under OFF's 100/min with room for the API's own lookups.
const REQUEST_GAP_MS = 800;
const FIELDS =
  "image_front_url,quantity,allergens_tags,traces_tags,labels_tags";

type OffProduct = NonNullable<OffProductPayload["product"]>;

type FetchResult =
  | { kind: "found"; product: OffProduct }
  | { kind: "not_on_off" }
  | { kind: "failed"; reason: string };

const RETRY_PAUSE_MS = 30_000;

/** A failed request is never mistaken for "OFF has no data". */
async function fetchFields(barcode: string): Promise<FetchResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode
  )}.json?fields=${FIELDS}`;
  try {
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": OFF_USER_AGENT },
    });
    if (response.status === 404) {
      return { kind: "not_on_off" };
    }
    if (!response.ok) {
      return { kind: "failed", reason: `HTTP ${response.status}` };
    }
    const payload = (await response.json()) as OffProductPayload;
    return payload.status === 1 && payload.product
      ? { kind: "found", product: payload.product }
      : { kind: "not_on_off" };
  } catch (error) {
    return { kind: "failed", reason: (error as Error).message };
  }
}

/** One retry after a pause (429 = OFF asking us to slow down, or a blip). */
async function fetchWithRetry(barcode: string): Promise<FetchResult> {
  const first = await fetchFields(barcode);
  if (first.kind !== "failed") {
    return first;
  }
  await sleep(RETRY_PAUSE_MS);
  return fetchFields(barcode);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const fromOff = { source: { $in: ["off", "manual_seed"] } };
  const barcodes = (
    await versions.distinct("barcode", {
      ...fromOff,
      $or: [
        { image_url: null },
        { quantity: null },
        { declared_allergens: null },
      ],
    })
  ).slice(0, LIMIT);

  if (!APPLY) {
    console.log(
      `${barcodes.length} barcodes have empty OFF fields (dry run; pass --apply).`
    );
    await mongoose.disconnect();
    return;
  }

  const filled = {
    image_url: 0,
    quantity: 0,
    declared_allergens: 0,
    declared_veg: 0,
  };
  const outcomes = { found: 0, not_on_off: 0, failed: 0 };
  for (const [index, barcode] of barcodes.entries()) {
    const result = await fetchWithRetry(barcode);
    outcomes[result.kind] += 1;
    if (result.kind === "failed") {
      console.warn(`${barcode}: failed (${result.reason}) — left for a re-run`);
    }
    if (result.kind === "found") {
      const { product } = result;
      const values = {
        image_url: offImageUrl(product.image_front_url),
        quantity: offQuantity(product.quantity),
        declared_allergens: declaredAllergens(product),
        declared_veg: declaredVeg(product),
      };
      for (const [field, value] of Object.entries(values)) {
        if (value === null) {
          continue;
        }
        const { modifiedCount } = await versions.updateMany(
          { barcode, ...fromOff, [field]: null },
          { $set: { [field]: value } }
        );
        filled[field as keyof typeof filled] += modifiedCount;
      }
    }
    if ((index + 1) % 50 === 0) {
      console.log(`${index + 1}/${barcodes.length}…`);
    }
    await sleep(REQUEST_GAP_MS);
  }

  console.log(`Done (${barcodes.length} barcodes):`, outcomes);
  console.log("Versions filled:", filled);
  if (outcomes.failed) {
    console.log(`${outcomes.failed} failed — re-run to retry them.`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
