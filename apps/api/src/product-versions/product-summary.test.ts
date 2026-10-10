import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Types } from "mongoose";
import { confirmsVersion, productSummary } from "./product-summary";

const sender = new Types.ObjectId();
const someoneElse = new Types.ObjectId();
const aiVersion = {
  id: "6ab7d04ffb5027914b128aed",
  name: "Masala chips",
  brand: "Local",
  source: "user_submission" as const,
  image_url: null,
  quantity: null,
  submitted_by: sender,
  confirmed_at: null as Date | null,
};

describe("productSummary", () => {
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
