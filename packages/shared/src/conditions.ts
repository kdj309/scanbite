import { z } from "zod";
import { uniqueListOf } from "./primitives";

/**
 * Canonical health-condition codes stored on household members and
 * personalization_rules.condition.
 *
 * Two display maps, on purpose:
 * - HEALTH_CONDITION_SHORT_LABELS: tiles and chips ("Sugar", "BP").
 * - HEALTH_CONDITION_LABELS: sentences ("Couldn't check sugar for diabetes").
 *   Short names would collide with nutrition topics ("sugar for sugar").
 */
export const healthConditionCodeSchema = z.enum([
  "diabetic",
  "hypertensive",
  "obesity",
  "cardiovascular",
  "dyslipidemia",
  "chronic_kidney_disease",
  "fatty_liver",
  "gout",
  "pcos",
  "hypothyroidism",
]);

export type HealthConditionCode = z.infer<typeof healthConditionCodeSchema>;

export const HEALTH_CONDITION_CODES: readonly HealthConditionCode[] =
  healthConditionCodeSchema.options;

export const healthConditionListSchema = uniqueListOf(
  healthConditionCodeSchema,
  "Duplicate condition"
);

/** Full name, for sentences and subtitles. */
export const HEALTH_CONDITION_LABELS: Record<HealthConditionCode, string> = {
  diabetic: "Diabetes",
  hypertensive: "Hypertension",
  obesity: "Obesity",
  cardiovascular: "Heart disease",
  dyslipidemia: "High cholesterol",
  chronic_kidney_disease: "Chronic kidney disease",
  fatty_liver: "Fatty liver",
  gout: "Gout",
  pcos: "PCOS",
  hypothyroidism: "Hypothyroidism",
};

/** Everyday name, for tiles and chips. */
export const HEALTH_CONDITION_SHORT_LABELS: Record<
  HealthConditionCode,
  string
> = {
  diabetic: "Sugar",
  hypertensive: "BP",
  obesity: "Weight",
  cardiovascular: "Heart",
  dyslipidemia: "Cholesterol",
  chronic_kidney_disease: "Kidney",
  fatty_liver: "Fatty liver",
  gout: "Gout",
  pcos: "PCOS",
  hypothyroidism: "Thyroid",
};
