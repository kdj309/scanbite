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
  effect: "escalate one level" as const,
  message: "High sugar — caution advised for diabetics",
  label: "Too sweet for diabetes",
};

/**
 * ICMR–NIN Dietary Guidelines for Indians 2024, Table 15.1 "high salt":
 * 625 mg salt/100 g solids, 175 mg/100 ml liquids. The guidelines put
 * salt at 40% sodium, so 250 / 70 mg sodium. The same guidelines tie high
 * salt to blood pressure, heart disease and the kidneys — hence one rule
 * pair per condition (a rule has one condition).
 */
const SALT_CONDITIONS = [
  {
    condition: "hypertensive" as const,
    label: "Too salty for BP",
    for: "high blood pressure",
  },
  {
    condition: "cardiovascular" as const,
    label: "Too salty for heart health",
    for: "heart disease",
  },
  {
    condition: "chronic_kidney_disease" as const,
    label: "Too salty for kidneys",
    for: "kidney disease",
  },
];

const ICMR_SALT_RULES = SALT_CONDITIONS.flatMap(
  ({ condition, label, ...rest }) => {
    const rule = {
      version: "1",
      effective_from: new Date("2026-01-01T00:00:00.000Z"),
      effective_to: null as Date | null,
      condition,
      operator: ">" as const,
      effect: "escalate one level" as const,
      // Not "caution": over this level it's always Avoid, since the base
      // FSSAI salt rule (120 mg) has already made it Caution.
      message: `Over ICMR's high-salt level — not advised for ${rest.for}`,
      label,
    };
    return [
      {
        ...rule,
        id: `${condition}_sodium_escalation`,
        field: "sodium_per_100g",
        threshold: 250,
        applies_to: "solid" as const,
      },
      {
        ...rule,
        id: `${condition}_sodium_escalation_liquid`,
        field: "sodium_per_100ml",
        threshold: 70,
        applies_to: "liquid" as const,
      },
    ];
  }
);

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
  ...ICMR_SALT_RULES,
];
