import { z } from "zod";

/**
 * Canonical health-condition codes stored on household members and
 * personalization_rules.condition. Display copy lives in HEALTH_CONDITION_LABELS.
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

export const healthConditionListSchema = z
  .array(healthConditionCodeSchema)
  .superRefine((codes, ctx) => {
    const seen = new Set<string>();
    for (const [index, code] of codes.entries()) {
      if (seen.has(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate condition",
          path: [index],
        });
      }
      seen.add(code);
    }
  });

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
