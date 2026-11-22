import type { FilterQuery } from "mongoose";
import { escapeRegex } from "../common/escape-regex";
import type { ProductVersionDocument } from "../database/schemas/product-version.schema";
import type { SearchCandidate } from "./product-search.types";

/** How many matches a search returns. */
export const SEARCH_LIMIT = 20;

/** Anything that isn't a letter or digit separates words ("Parle-G", "(Zorbit)"). */
const WORD_BREAK = /[^\p{L}\p{N}]+/u;

/** Live products whose name or brand contains the text (Home search, Explore). */
export function nameOrBrandFilter(
  text: string
): FilterQuery<ProductVersionDocument> {
  const pattern = new RegExp(escapeRegex(text.trim()), "i");
  return { status: "live", $or: [{ name: pattern }, { brand: pattern }] };
}

/** The same, but only where a word of the name or brand starts with it. */
export function wordStartFilter(
  text: string
): FilterQuery<ProductVersionDocument> {
  // ASCII word breaks: MongoDB regexes, and catalogue names are in English.
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(text.trim())}`, "i");
  return { status: "live", $or: [{ name: pattern }, { brand: pattern }] };
}

/**
 * Best match first: the name starts with the query, then a word in the
 * name does, then a word in the brand does, then it appears anywhere. Ties
 * keep the order given (newest first).
 */
export function rankSearchMatches<T extends SearchCandidate>(
  matches: readonly T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  const tier = (match: T): number => {
    const name = match.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(WORD_BREAK).some((word) => word.startsWith(q))) return 1;
    const brandWords = match.brand.toLowerCase().split(WORD_BREAK);
    if (brandWords.some((word) => word.startsWith(q))) return 2;
    return 3;
  };
  return matches
    .map((match, index) => ({ match, index, tier: tier(match) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map(({ match }) => match);
}
