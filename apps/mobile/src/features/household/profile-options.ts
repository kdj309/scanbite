import type { AllergenCode, HealthConditionCode } from "@foodscanner/shared";

/** A person's profile choices, shared by setup and the edit screen. */
export const AGE_BANDS = ["0–12", "13–17", "18–39", "40–59", "60+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Shown as tiles; the rest sit behind "More conditions". */
export const MAIN_CONDITIONS: readonly HealthConditionCode[] = [
  "diabetic",
  "hypertensive",
  "dyslipidemia",
  "hypothyroidism",
  "cardiovascular",
  "obesity",
];
export const MORE_CONDITIONS: readonly HealthConditionCode[] = [
  "chronic_kidney_disease",
  "fatty_liver",
  "gout",
  "pcos",
];

/** The design's eight; the other three sit behind "More allergies". */
export const MAIN_ALLERGIES: readonly AllergenCode[] = [
  "peanuts",
  "tree_nuts",
  "milk",
  "gluten",
  "soy",
  "egg",
  "sesame",
  "shellfish",
];
export const MORE_ALLERGIES: readonly AllergenCode[] = [
  "fish",
  "mustard",
  "sulphites",
];

/** Toggle a code in a list, keeping it free of duplicates. */
export function toggled<T>(list: readonly T[], item: T): T[] {
  return list.includes(item)
    ? list.filter((value) => value !== item)
    : [...list, item];
}
