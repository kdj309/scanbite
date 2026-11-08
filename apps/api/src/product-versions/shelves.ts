/**
 * Shelves: the groups a shopper would compare products within ("Better
 * options" swaps stay on one shelf). The catalogue's categories come from
 * Open Food Facts, where volunteers file products unevenly (malt drinks
 * sit under three different ones), so each category is placed on a shelf
 * here. Products read from label photos are filed by shelf name directly.
 * Agreed with Kartik 2026-11-08; categories not listed have no shelf.
 */
export const SHELVES = {
  "Biscuits & cakes": ["Biscuits and cakes", "Snacks", "Pastries"],
  "Salty snacks": ["Appetizers", "Potatoes", "Chips", "Ready to Eat Snacks"],
  "Sweets & chocolate": [
    "Sweets",
    "Chocolate products",
    "Dark chocolates with hazelnuts",
    "Confectionary based spreads",
  ],
  "Desserts & ice cream": ["Ice cream", "Dairy desserts"],
  "Sugary & soft drinks": [
    "Sweetened beverages",
    "Artificially sweetened beverages",
    "Fruit juices",
    "Beverages And Beverages Preparations",
    "Alcoholic beverages",
  ],
  "Water & unsweetened drinks": [
    "Waters and flavored waters",
    "Unsweetened beverages",
  ],
  "Tea, coffee & health drinks": [
    "Teas and herbal teas and coffees",
    "Barley malt flours",
  ],
  "Cereals, noodles & bread": [
    "Breakfast cereals",
    "Cereals",
    "breakfast",
    "Millet Mix",
    "Bread",
  ],
  "Dairy & eggs": [
    "Milk and yogurt",
    "Cheese",
    "Plant-based milk substitutes",
    "Eggs",
  ],
  "Dals, nuts & dry fruit": ["Legumes", "Nuts", "Dried fruits"],
  "Pickles, sauces & oils": [
    "Dressings and sauces",
    "Salty and fatty products",
    "Pickle",
    "Fats",
  ],
  "Meals, meat & other": [
    "One-dish meals",
    "Soups",
    "Meat",
    "Processed meat",
    "Fish and seafood",
    "Meals with pork",
    "Pizza pies and quiches",
    "Fruits",
    "Vegetables",
    "Baby foods",
    "Baby milks",
  ],
} as const;

export type Shelf = keyof typeof SHELVES;

export const SHELF_NAMES = Object.keys(SHELVES) as Shelf[];

// Keyed lower case: a label read may write "Salty Snacks".
const SHELF_BY_CATEGORY = new Map<string, Shelf>(
  SHELF_NAMES.flatMap((shelf) =>
    categoriesOn(shelf).map(
      (category) => [category.toLowerCase(), shelf] as const
    )
  )
);

/** The shelf a stored category belongs on; null when it has none. */
export function shelfOf(category: string): Shelf | null {
  return SHELF_BY_CATEGORY.get(category.trim().toLowerCase()) ?? null;
}

/** Every stored category that sits on this shelf, the shelf name included. */
export function categoriesOn(shelf: Shelf): string[] {
  return [shelf, ...SHELVES[shelf]];
}
