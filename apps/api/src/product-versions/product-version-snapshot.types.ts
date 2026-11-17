import type { VersionSnapshot } from "../consensus/conflict";

/** A version's ingredients split into recognised ids and unrecognised text. */
export type IngredientSets = Pick<
  VersionSnapshot,
  "resolvedCanonicalIds" | "unresolvedRaw"
>;
