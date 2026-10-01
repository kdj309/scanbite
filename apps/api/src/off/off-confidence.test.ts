import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { offExtractionConfidence } from "./off-confidence";

describe("offExtractionConfidence", () => {
  it("is highest when both ingredients and nutrition are marked complete", () => {
    const confidence = offExtractionConfidence({
      statesTags: ["en:ingredients-completed", "en:nutrition-facts-completed"],
      dataQualityErrorsTags: [],
    });
    assert.equal(confidence, 0.9);
  });

  it("is lower when only ingredients are marked complete", () => {
    const confidence = offExtractionConfidence({
      statesTags: ["en:ingredients-completed"],
      dataQualityErrorsTags: [],
    });
    assert.equal(confidence, 0.75);
  });

  it("is lowest when neither completeness tag is set", () => {
    const confidence = offExtractionConfidence({
      statesTags: [],
      dataQualityErrorsTags: [],
    });
    assert.equal(confidence, 0.55);
  });

  it("penalizes a flagged data-quality error even on an otherwise-complete entry", () => {
    const confidence = offExtractionConfidence({
      statesTags: ["en:ingredients-completed", "en:nutrition-facts-completed"],
      dataQualityErrorsTags: ["en:nutrition-value-total-over-105"],
    });
    assert.equal(confidence, 0.65);
  });

  it("floors the data-quality penalty rather than going negative", () => {
    const confidence = offExtractionConfidence({
      statesTags: [],
      dataQualityErrorsTags: ["en:some-error"],
    });
    assert.equal(confidence, 0.3);
  });
});
