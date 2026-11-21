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
import {
  ProductVersion,
  ProductVersionSchema,
} from "../database/schemas/product-version.schema";
import {
  declaredAllergens,
  declaredVeg,
  offImageUrl,
  offQuantity,
} from "../off/off-mapper";
import { fetchOffProductWithRetry } from "../off/off-fetch";

const MONGO_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27018/foodscanner";
const APPLY = process.argv.includes("--apply");
const LIMIT = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ??
    Infinity
);
/** ~75 reads a minute: under OFF's 100, with room for the API's own lookups. */
const REQUEST_GAP_MS = 800;
const FIELDS =
  "image_front_url,quantity,allergens_tags,traces_tags,labels_tags";

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
    const result = await fetchOffProductWithRetry(barcode, FIELDS);
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
