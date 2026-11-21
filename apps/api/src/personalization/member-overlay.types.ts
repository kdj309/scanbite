/** How a nutrition fact is named in a check, in reason text, and its unit. */
export type NutritionFact = {
  topic: string;
  inText: string;
  unit?: "g" | "mg";
};
