import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Types } from "mongoose";
import { ConfigService } from "@nestjs/config";
import {
  confirmsVersion,
  labelCheckSummary,
  productSummary,
  ProductSummaryService,
} from "./product-summary";

const sender = new Types.ObjectId();
const someoneElse = new Types.ObjectId();
const aiVersion = {
  id: "6ab7d04ffb5027914b128aed",
  name: "Masala chips",
  brand: "Local",
  source: "user_submission" as const,
  image_url: null,
  quantity: null,
  category: "Chips",
  submitted_by: sender,
  confirmed_at: null as Date | null,
  declared_veg: null as "veg" | "non_veg" | null,
  ingredients: [
    { raw: "Potato", canonical_id: null, status: "unresolved" as const },
  ],
};

describe("productSummary", () => {
  it("puts a product on its shelf, or none when its category has none", () => {
    assert.equal(productSummary(aiVersion).shelf, "Salty snacks");
    assert.equal(
      productSummary({ ...aiVersion, category: "unknown" }).shelf,
      null
    );
  });

  it("marks an unconfirmed photo-read product as verifying", () => {
    const summary = productSummary(aiVersion);
    assert.equal(summary.source, "ai_photos");
    assert.equal(summary.verifying, true);
    assert.equal(summary.image_url, null);
  });

  it("stops verifying once confirmed", () => {
    const summary = productSummary({ ...aiVersion, confirmed_at: new Date() });
    assert.equal(summary.verifying, false);
  });

  it("treats Open Food Facts and seed products as catalog, never verifying", () => {
    for (const source of ["off", "manual_seed"] as const) {
      const summary = productSummary({
        ...aiVersion,
        source,
        submitted_by: null,
        image_url: "https://images.openfoodfacts.org/x.jpg",
        quantity: "1.25 l",
      });
      assert.deepEqual(
        [summary.source, summary.verifying, summary.quantity],
        ["catalog", false, "1.25 l"]
      );
    }
  });
});

describe("confirmsVersion", () => {
  it("is confirmed by a different person's matching photos", () => {
    assert.equal(confirmsVersion(aiVersion, someoneElse), true);
  });

  it("is not confirmed by the same person scanning again", () => {
    assert.equal(confirmsVersion(aiVersion, sender), false);
  });

  it("ignores catalog products, already-confirmed ones and unknown senders", () => {
    assert.equal(
      confirmsVersion({ ...aiVersion, source: "off" }, someoneElse),
      false
    );
    assert.equal(
      confirmsVersion({ ...aiVersion, confirmed_at: new Date() }, someoneElse),
      false
    );
    assert.equal(
      confirmsVersion({ ...aiVersion, submitted_by: null }, someoneElse),
      false
    );
  });
});

describe("productSummary veg badge", () => {
  it("shows the pack's FSSAI symbol", () => {
    assert.equal(
      productSummary({ ...aiVersion, declared_veg: "veg" }).veg,
      "veg"
    );
    assert.equal(
      productSummary({ ...aiVersion, declared_veg: "non_veg" }).veg,
      "non_veg"
    );
  });

  it("is unknown without the symbol — never guessed", () => {
    assert.equal(productSummary(aiVersion).veg, "unknown");
  });
});

describe("productSummary.has_ingredients", () => {
  it("says whether an ingredients list was read", () => {
    assert.equal(productSummary(aiVersion).has_ingredients, true);
    assert.equal(
      productSummary({ ...aiVersion, ingredients: [] }).has_ingredients,
      false
    );
  });
});

describe("ProductSummaryService buy links", () => {
  const service = new ProductSummaryService(
    new ConfigService({ AMAZON_ASSOCIATE_TAG: "scanbite-21" }) as never
  );

  it("tags Amazon links with our affiliate tag", () => {
    const amazon = service
      .summarize(aiVersion)
      .buy_links.find((link) => link.store === "amazon");
    assert.equal(amazon?.affiliate, true);
    assert.match(amazon?.url ?? "", /tag=scanbite-21/);
  });

  it("gives plain links for a product we still flag", () => {
    const links = service.summarizeWithoutAffiliate(aiVersion).buy_links;
    assert.ok(links.length > 0);
    assert.ok(links.every((link) => !link.affiliate));
    assert.ok(links.every((link) => !link.url.includes("tag=")));
  });
});

describe("labelCheckSummary", () => {
  it("searches the stores by brand and name, as label checks have no pack size", () => {
    // A real label check: Mahalakshmi EXTRA Puliyogare (no barcode).
    const links = labelCheckSummary("6ab7d04ffb5027914b128aed", {
      name: "PULIYOGARE TAMARIND RICH MIX",
      brand: "Mahalakshmi EXTRA",
      ingredients: [],
    }).buy_links;
    assert.deepEqual(
      links.map((link) => link.store),
      ["amazon", "bigbasket"]
    );
    const amazon = new URL(links[0].url);
    assert.equal(
      amazon.searchParams.get("k"),
      "Mahalakshmi EXTRA PULIYOGARE TAMARIND RICH MIX"
    );
  });

  it("has no links when the label gave no name", () => {
    const summary = labelCheckSummary("6ab7d04ffb5027914b128aed", {
      name: "unknown",
      brand: "unknown",
      ingredients: [],
    });
    assert.deepEqual(summary.buy_links, []);
  });
});
