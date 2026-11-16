/**
 * Desserts the WHO South-East Asia nutrient profile model (2017) gives
 * their own limits, per 100 g, or per 100 ml where that's how the label
 * declares it. Agreed with Kartik 2026-11-16, groups kept apart:
 * - 7 frozen dairy desserts and edible ices (ice cream, frozen desserts,
 *   frozen yoghurt, lollies, sorbet)
 * - 8 curded dairy desserts (shrikhand, flavoured yoghurt, puddings)
 * Ice cream labels are often per 100 ml, which made them look like drinks;
 * these are never drinks.
 */
export type DessertForm = "frozen_dessert" | "curded_dessert";

const FORM_BY_CATEGORY = new Map<string, DessertForm>([
  ["ice cream", "frozen_dessert"],
  ["dairy desserts", "curded_dessert"],
]);

/** The dessert group a stored category is in; null for everything else. */
export function dessertForm(category: string): DessertForm | null {
  return FORM_BY_CATEGORY.get(category.trim().toLowerCase()) ?? null;
}

/** The stored categories in a dessert group (better options stay in it). */
export function dessertCategories(form: DessertForm): string[] {
  return form === "frozen_dessert" ? ["Ice cream"] : ["Dairy desserts"];
}

export function isDessertForm(form: unknown): form is DessertForm {
  return form === "frozen_dessert" || form === "curded_dessert";
}
