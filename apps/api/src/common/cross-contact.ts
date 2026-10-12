// A cross-contact warning inside an ingredient list: "May contain(s) traces
// of nuts", "Made on shared equipment with milk", "Manufactured in a
// facility that also processes peanuts".
const CROSS_CONTACT = new RegExp(
  [
    /\bmay contains?\b/,
    /\btraces? of\b/,
    // The verb is part of the warning, so "Made on" isn't left behind.
    /\b((made|processed|manufactured|produced|packed) (on|in|using) )?(the )?(same|shared) (facility|equipment|line|plant|unit)\b/,
    /\b(processed|manufactured|made|produced|packed) (in|on) (a|the same) (facility|plant|factory|unit|line)\b/,
  ]
    .map((pattern) => `(?:${pattern.source})`)
    .join("|"),
  "i"
);

/**
 * Splits an ingredient list into the recipe and its cross-contact warning.
 * Everything from the warning on is cross-contact ("May contain traces of
 * nuts, milk" arrives as two "ingredients"), including when it's run into
 * an ingredient: "Egg. May contain nuts" keeps "Egg." in the recipe.
 */
export function splitCrossContact(ingredients: string[]): {
  recipe: string[];
  crossContact: string[];
} {
  const index = ingredients.findIndex((item) => CROSS_CONTACT.test(item));
  if (index === -1) {
    return { recipe: ingredients, crossContact: [] };
  }
  const item = ingredients[index];
  const start = item.search(CROSS_CONTACT);
  const before = item.slice(0, start).trim();
  return {
    recipe: [...ingredients.slice(0, index), ...(before ? [before] : [])],
    crossContact: [item.slice(start), ...ingredients.slice(index + 1)],
  };
}
