import type { ClosenessProduct } from "./closeness.types";

/** Words that say little about what a product is. */
const FILLER = new Set([
  "with",
  "free",
  "pack",
  "rich",
  "classic",
  "fresh",
  "flavour",
  "flavoured",
  "flavor",
  "flavored",
  "style",
  "special",
  "premium",
  "original",
  "pure",
]);

/** The words that say what a product is: no brand, no filler, 4+ letters. */
function kindWords(product: ClosenessProduct): Set<string> {
  const brand = new Set(words(product.brand));
  return new Set(
    words(product.name).filter(
      (word) => word.length >= 4 && !FILLER.has(word) && !brand.has(word)
    )
  );
}

function words(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}

/**
 * How alike a candidate is to the scanned product, lower = closer: 0 when
 * their names share a word for what they are ("ketchup"), 1 in the same
 * catalogue category, 2 elsewhere on the shelf. A shelf mixes kinds
 * (ketchup, vinegar, mayonnaise), so swaps rank like-for-like first.
 */
export function closeness(
  original: ClosenessProduct,
  candidate: ClosenessProduct
): number {
  const originalKind = kindWords(original);
  if ([...kindWords(candidate)].some((word) => originalKind.has(word))) {
    return 0;
  }
  return candidate.category === original.category ? 1 : 2;
}
