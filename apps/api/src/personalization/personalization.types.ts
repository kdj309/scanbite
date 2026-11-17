import type { HealthConditionCode, Nutrition } from "@foodscanner/shared";
import type { VersionIngredient } from "../database/schemas/product-version.schema";
import type { PersonalizationEffect } from "../database/schemas/personalization-rule.schema";
import type {
  ProductForm,
  RuleOperator,
} from "../database/schemas/rule-set.schema";
import type { EvaluationResult } from "../scoring/evaluate-rules";
import type { MemberOverlay } from "./member-overlay";

export type PersonalizationRuleInput = {
  id: string;
  condition: HealthConditionCode;
  field: string;
  operator: RuleOperator;
  threshold?: number;
  value?: unknown;
  effect: PersonalizationEffect;
  message: string;
  label?: string;
  applies_to?: ProductForm;
};

export type ApplyPersonalizationInput = {
  base: EvaluationResult;
  facts: Record<string, unknown>;
  memberConditions: HealthConditionCode[];
  rules: PersonalizationRuleInput[];
};

/** One topic a member's conditions needed but the label didn't give. */
export type ConditionGap = {
  field: string;
  ruleId: string;
  /** Every condition that needed it, in words ("heart disease"). */
  conditions: string[];
};

export type VerdictReasonsInput = {
  base: EvaluationResult;
  /** Everything member-specific (conditions, allergies), combined. */
  overlay: MemberOverlay;
  ruleLabels: Record<string, string>;
};

/** The parts of a label shown as "what we read": a product version or a label check. */
export type ReadLabel = {
  ingredients: Pick<VersionIngredient, "raw">[];
  nutrition: Nutrition;
};
