import "reflect-metadata";
/**
 * Fills fields added to Open Food Facts imports after products were stored:
 * image_url, quantity and declared_allergens. Paced under OFF's read limit
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
import { declaredAllergens, offImageUrl, offQuantity } from "../off/off-mapper";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";
const APPLY = process.argv.includes("--apply");
const LIMIT = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ??
    Infinity
);
const REQUEST_GAP_MS = 650; // ~92 reads/min
const FIELDS = "image_front_url,quantity,allergens_tags,traces_tags";

type OffProduct = NonNullable<OffProductPayload["product"]>;

async function fetchFields(barcode: string): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode
  )}.json?fields=${FIELDS}`;
  const response = await fetchWithTimeout(url, {
    headers: { "User-Agent": OFF_USER_AGENT },
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as OffProductPayload;
  return payload.status === 1 ? (payload.product ?? null) : null;
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

  const filled = { image_url: 0, quantity: 0, declared_allergens: 0 };
  for (const [index, barcode] of barcodes.entries()) {
    const product = await fetchFields(barcode).catch(() => null);
    const values = {
      image_url: offImageUrl(product?.image_front_url),
      quantity: offQuantity(product?.quantity),
      declared_allergens: product ? declaredAllergens(product) : null,
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
    if ((index + 1) % 50 === 0) {
      console.log(`${index + 1}/${barcodes.length}…`);
    }
    await sleep(REQUEST_GAP_MS);
  }

  console.log(`Done (${barcodes.length} barcodes). Versions filled:`, filled);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
