/**
 * "Scan the label again" (design 2c) against real Mongo: new photos of a
 * live product that had no ingredients replace it when they're clear enough
 * and look like the same pack, below the usual auto-promote confidence.
 *
 *   pnpm --filter api build && pnpm --filter api test:integration
 */
import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import mongoose from "mongoose";
import { connectTestDb, dropTestDb } from "../common/integration-db";
import {
  ProductVersion,
  ProductVersionSchema,
  type VersionIngredient,
} from "../database/schemas/product-version.schema";
import { Product, ProductSchema } from "../database/schemas/product.schema";
import { AUTO_PROMOTE_CONFIDENCE, FILL_NO_RESULT_CONFIDENCE } from "./conflict";
import { ConsensusService } from "./consensus.service";

const BARCODE = "8901234567890";
const PACK = { name: "Classic salted chips", brand: "Crunchy" };
const INGREDIENT: VersionIngredient = {
  raw: "potato",
  canonical_id: null,
  status: "unresolved",
};

/** Clear enough to fill a "No result", too unsure to replace a real read. */
const CLEAR_READ = (FILL_NO_RESULT_CONFIDENCE + AUTO_PROMOTE_CONFIDENCE) / 2;

describe("replacing a live product that had no result (integration)", () => {
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const products = mongoose.model(Product.name, ProductSchema);
  const consensus = new ConsensusService(
    mongoose.connection,
    versions as never,
    products as never
  );

  /** A live version with the given ingredients, and a pending read to try. */
  async function setUp(
    live: Partial<ProductVersion>,
    pending: Partial<ProductVersion>
  ) {
    const product = await products.create({ barcode: BARCODE });
    const base = {
      product_id: product._id,
      barcode: BARCODE,
      category: "Salty snacks",
      source: "user_submission",
      ...PACK,
    };
    await versions.create({ ...base, ...live, status: "live" });
    const candidate = await versions.create({
      ...base,
      ingredients: [INGREDIENT],
      extraction_confidence: CLEAR_READ,
      status: "pending",
      ...pending,
    });
    return candidate.id as string;
  }

  before(() => connectTestDb("foodscanner_test_consensus"));
  beforeEach(async () => {
    await versions.deleteMany({});
    await products.deleteMany({});
  });
  after(() => dropTestDb());

  it("goes live when the live version had no ingredients", async () => {
    const id = await setUp({ ingredients: [] }, {});
    assert.deepEqual(await consensus.promoteIfEligible(id), {
      promoted: true,
      productVersionId: id,
    });
  });

  it("waits for review when the live version already had ingredients", async () => {
    const id = await setUp({ ingredients: [INGREDIENT] }, {});
    const result = await consensus.promoteIfEligible(id);
    assert.equal(result.promoted, false);
  });

  it("waits for review when the photos look like another pack", async () => {
    const id = await setUp(
      { ingredients: [] },
      { name: "Masala peanuts", brand: "Nutty" }
    );
    const result = await consensus.promoteIfEligible(id);
    assert.equal(result.promoted, false);
  });

  it("waits for review when the read has no confidence score", async () => {
    const id = await setUp(
      { ingredients: [] },
      { extraction_confidence: undefined }
    );
    const result = await consensus.promoteIfEligible(id);
    assert.equal(result.promoted, false);
  });
});
