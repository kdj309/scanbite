import type { VersionSnapshot } from "../consensus/conflict";
import type { ProductVersionDocument } from "../database/schemas/product-version.schema";
import type { ExtractionOutput } from "../workers/vision/extraction-output";
import type { ResolvedIngredientRow } from "./product-version-ingestion.service";

/**
 * Turns resolved ingredients into the two sets planAfterExtraction compares
 * (conflict.ts) — lives here, not in extraction.pipeline.ts, because it's
 * about how a ProductVersion's data is represented/compared, the same
 * concern ProductVersionIngestionService owns for how one gets created.
 */
function ingredientSetsFromRows(ingredients: ResolvedIngredientRow[]): {
  resolvedCanonicalIds: string[];
  unresolvedRaw: string[];
} {
  const resolvedCanonicalIds: string[] = [];
  const unresolvedRaw: string[] = [];
  for (const ingredient of ingredients) {
    if (ingredient.canonical_id) {
      resolvedCanonicalIds.push(String(ingredient.canonical_id));
    } else {
      unresolvedRaw.push(ingredient.raw);
    }
  }
  return { resolvedCanonicalIds, unresolvedRaw };
}

export function snapshotFromVersion(
  version: ProductVersionDocument
): VersionSnapshot {
  return {
    name: version.name,
    brand: version.brand,
    nutrition: version.nutrition ?? {},
    ...ingredientSetsFromRows(version.ingredients),
    extraction_confidence: version.extraction_confidence ?? 0,
  };
}

export function snapshotFromIncoming(
  extracted: ExtractionOutput,
  ingredients: ResolvedIngredientRow[]
): VersionSnapshot {
  return {
    name: extracted.name,
    brand: extracted.brand,
    nutrition: extracted.nutrition,
    ...ingredientSetsFromRows(ingredients),
    extraction_confidence: extracted.extraction_confidence,
  };
}
