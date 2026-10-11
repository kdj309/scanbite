/** Names that mean something in an ingredient list, minus look-alikes. */
export type AliasList = {
  include: RegExp[];
  /** All look-alikes as one pattern, removed before matching. */
  exclude: RegExp | null;
};

/**
 * Compiles an alias list once. Every pattern is made case-insensitive here,
 * so "INS 120" and "ins 120" both work however a pattern is written.
 */
export function aliasList(patterns: {
  include: RegExp[];
  exclude?: RegExp[];
}): AliasList {
  const exclude = patterns.exclude ?? [];
  return {
    include: patterns.include.map((pattern) => new RegExp(pattern.source, "i")),
    exclude: exclude.length
      ? new RegExp(exclude.map((p) => `(?:${p.source})`).join("|"), "gi")
      : null,
  };
}

/** Whether one ingredient string names this thing ("coconut milk" isn't milk). */
export function namesAlias(ingredient: string, aliases: AliasList): boolean {
  const cleaned = aliases.exclude
    ? ingredient.replace(aliases.exclude, " ")
    : ingredient;
  return aliases.include.some((pattern) => pattern.test(cleaned));
}
