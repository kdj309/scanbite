import "reflect-metadata";
/**
 * Fills image_url and quantity on Open Food Facts / seed products stored
 * before those fields were imported. Paced under OFF's read limit
 * (100 product reads/min), so ~1,600 barcodes take about 17 minutes.
 * Only empty fields are written; safe to stop and re-run.
 *
 * Dry run by default (counts, no requests); --apply to fetch and write;
 * --limit=N to try a few first.
 *
 *   pnpm build && node dist/admin/backfill-off-images.js [--apply] [--limit=20]
 */
import { setTimeout as sleep } from "node:timers/promises";
import mongoose from "mongoose";
import { fetchWithTimeout } from "../common/fetch-with-timeout";
import {
  ProductVersion,
  ProductVersionSchema,
} from "../database/schemas/product-version.schema";
import { OFF_USER_AGENT } from "../off/off-lookup.service";
import { offImageUrl, offQuantity } from "../off/off-mapper";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";
const APPLY = process.argv.includes("--apply");
const LIMIT = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ??
    Infinity
);
const REQUEST_GAP_MS = 650; // ~92 reads/min

type OffImageFields = { image_front_url?: string; quantity?: string };

async function fetchImageFields(
  barcode: string
): Promise<OffImageFields | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode
  )}.json?fields=image_front_url,quantity`;
  const response = await fetchWithTimeout(url, {
    headers: { "User-Agent": OFF_USER_AGENT },
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    status: number;
    product?: OffImageFields;
  };
  return payload.status === 1 ? (payload.product ?? null) : null;
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const missing = { source: { $in: ["off", "manual_seed"] }, image_url: null };
  const barcodes = (await versions.distinct("barcode", missing)).slice(
    0,
    LIMIT
  );

  if (!APPLY) {
    console.log(
      `${barcodes.length} barcodes need image/quantity (dry run; pass --apply).`
    );
    await mongoose.disconnect();
    return;
  }

  let filled = 0;
  for (const [index, barcode] of barcodes.entries()) {
    const fields = await fetchImageFields(barcode).catch(() => null);
    const image = offImageUrl(fields?.image_front_url);
    const quantity = offQuantity(fields?.quantity);
    if (image) {
      await versions.updateMany(
        { barcode, ...missing },
        { $set: { image_url: image } }
      );
      filled += 1;
    }
    if (quantity) {
      await versions.updateMany(
        { barcode, source: missing.source, quantity: null },
        { $set: { quantity } }
      );
    }
    if ((index + 1) % 50 === 0) {
      console.log(`${index + 1}/${barcodes.length}…`);
    }
    await sleep(REQUEST_GAP_MS);
  }

  console.log(`Done. ${filled} of ${barcodes.length} barcodes got an image.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
