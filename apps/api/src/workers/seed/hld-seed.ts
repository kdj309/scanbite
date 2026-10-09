import { HLD_EXAMPLE_RULES } from "../../scoring/hld-example-rules";

export const HLD_RULE_SET_SEED = {
  version: "1",
  effective_from: new Date("2026-01-01T00:00:00.000Z"),
  effective_to: null as Date | null,
  rules: HLD_EXAMPLE_RULES,
};

const DIABETIC_SUGAR_RULE = {
  version: "1",
  effective_from: new Date("2026-01-01T00:00:00.000Z"),
  effective_to: null as Date | null,
  condition: "diabetic" as const,
  operator: ">" as const,
  effect: "escalate one level",
  message: "High sugar — caution advised for diabetics",
  label: "Too sweet for diabetes",
};

/** HLD §7 diabetic example, as a solid + drink pair like the base sugar
 *  rules. The drink threshold is half the solid one, the same halving UK
 *  front-of-pack uses for liquids (22.5 g -> 11.25 g). */
export const HLD_PERSONALIZATION_SEEDS = [
  {
    ...DIABETIC_SUGAR_RULE,
    id: "diabetic_sugar_escalation",
    field: "sugar_per_100g",
    threshold: 15,
    applies_to: "solid" as const,
  },
  {
    ...DIABETIC_SUGAR_RULE,
    id: "diabetic_sugar_escalation_liquid",
    field: "sugar_per_100ml",
    threshold: 7.5,
    applies_to: "liquid" as const,
  },
];
