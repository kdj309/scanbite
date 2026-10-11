import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buyLinks } from "./buy-links";

const search = (url: string, key: string) => new URL(url).searchParams.get(key);

describe("buyLinks", () => {
  it("searches by brand, name and pack size", () => {
    const [amazon, bigbasket] = buyLinks(
      { name: "Jimjam", brand: "Britannia", quantity: "57 g" },
      {}
    );
    assert.equal(search(amazon.url, "k"), "Britannia Jimjam 57 g");
    assert.equal(search(bigbasket.url, "q"), "Britannia Jimjam 57 g");
  });

  it("doesn't repeat a brand or size the name already has", () => {
    const [amazon] = buyLinks(
      { name: "Amul Taaza milk 500ml", brand: "Amul", quantity: "500ml" },
      {}
    );
    assert.equal(search(amazon.url, "k"), "Amul Taaza milk 500ml");
  });

  it("treats '57 g' and '57g' as the same size (real OFF data)", () => {
    const [amazon] = buyLinks(
      { name: "Jimjam 57g (57)", brand: "Britannia", quantity: "57 g" },
      {}
    );
    assert.equal(search(amazon.url, "k"), "Britannia Jimjam 57g (57)");
  });

  it("adds our Amazon tag when configured and marks it as affiliate", () => {
    const [amazon, bigbasket] = buyLinks(
      { name: "Kurkure", brand: "PepsiCo", quantity: null },
      { amazon: "scanbite-21" }
    );
    assert.equal(search(amazon.url, "tag"), "scanbite-21");
    assert.deepEqual([amazon.affiliate, bigbasket.affiliate], [true, false]);
  });

  it("is a plain, non-affiliate Amazon link without a tag", () => {
    const [amazon] = buyLinks(
      { name: "Kurkure", brand: "PepsiCo", quantity: null },
      {}
    );
    assert.equal(search(amazon.url, "tag"), null);
    assert.equal(amazon.affiliate, false);
  });

  it("encodes odd characters safely", () => {
    const [amazon] = buyLinks(
      { name: "Choco & Nut Bar #1", brand: "unknown", quantity: null },
      {}
    );
    assert.equal(search(amazon.url, "k"), "Choco & Nut Bar #1");
    assert.ok(!amazon.url.includes(" "));
  });

  it("offers no links when we don't know the product's name", () => {
    assert.deepEqual(
      buyLinks(
        { name: "unknown", brand: "Local", quantity: null },
        { amazon: "scanbite-21" }
      ),
      []
    );
  });
});
