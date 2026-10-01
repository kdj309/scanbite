import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClaudeVisionAdapter } from "./claude-vision.adapter";
import type { ExtractionOutput } from "./extraction-output";
import type { GeminiVisionAdapter } from "./gemini-vision.adapter";
import { TieredVisionAdapter } from "./tiered-vision.adapter";

const INPUT = { barcode: "123", photoKeys: ["labels/123/a.jpg"] };

function extraction(
  overrides: Partial<ExtractionOutput> = {}
): ExtractionOutput {
  return {
    name: "Product",
    brand: "Brand",
    category: "category",
    ingredients: ["Sugar"],
    nutrition: {},
    extraction_confidence: 0.9,
    photo_consistency: "consistent",
    ...overrides,
  };
}

function fakeGemini(
  behavior: () => Promise<ExtractionOutput>
): GeminiVisionAdapter {
  return { extract: behavior } as unknown as GeminiVisionAdapter;
}

function fakeClaude(
  behavior: () => Promise<ExtractionOutput>
): ClaudeVisionAdapter {
  return { extract: behavior } as unknown as ClaudeVisionAdapter;
}

describe("TieredVisionAdapter", () => {
  it("returns Gemini's result without calling Claude when confidence is high", async () => {
    let claudeCalled = false;
    const adapter = new TieredVisionAdapter(
      fakeGemini(async () => extraction({ extraction_confidence: 0.9 })),
      fakeClaude(async () => {
        claudeCalled = true;
        return extraction({ name: "should not be used" });
      })
    );
    const result = await adapter.extract(INPUT);
    assert.equal(result.name, "Product");
    assert.equal(claudeCalled, false);
  });

  it("escalates to Claude when Gemini's confidence is below the threshold", async () => {
    const adapter = new TieredVisionAdapter(
      fakeGemini(async () => extraction({ extraction_confidence: 0.2 })),
      fakeClaude(async () => extraction({ name: "Claude answer" }))
    );
    const result = await adapter.extract(INPUT);
    assert.equal(result.name, "Claude answer");
  });

  it("escalates to Claude when Gemini itself throws", async () => {
    const adapter = new TieredVisionAdapter(
      fakeGemini(async () => {
        throw new Error("gemini down");
      }),
      fakeClaude(async () => extraction({ name: "Claude answer" }))
    );
    const result = await adapter.extract(INPUT);
    assert.equal(result.name, "Claude answer");
  });

  it("falls back to Gemini's low-confidence result if the Claude escalation call fails", async () => {
    const adapter = new TieredVisionAdapter(
      fakeGemini(async () =>
        extraction({ extraction_confidence: 0.2, name: "Gemini answer" })
      ),
      fakeClaude(async () => {
        throw new Error("claude down");
      })
    );
    const result = await adapter.extract(INPUT);
    assert.equal(result.name, "Gemini answer");
  });

  it("rethrows if both Gemini and Claude fail", async () => {
    const adapter = new TieredVisionAdapter(
      fakeGemini(async () => {
        throw new Error("gemini down");
      }),
      fakeClaude(async () => {
        throw new Error("claude down");
      })
    );
    await assert.rejects(() => adapter.extract(INPUT), /claude down/);
  });
});
