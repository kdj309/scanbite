import {
  ALLERGEN_LABELS,
  type AllergenCode,
  type FlagReason,
  type UncheckedReason,
} from "@foodscanner/shared";
import {
  uncheckedReason,
  type MemberOverlay,
  type TopicCheck,
} from "../personalization/member-overlay";
import type { AllergenEvidence } from "./allergen-evidence";

/**
 * A member's allergies against one product:
 *  - contains or may contain one of them -> Avoid (cross-contact counts:
 *    decided 2026-10-07, strict);
 *  - no ingredient list -> "couldn't check", and never Safe.
 * A "may contain" nobody recorded can't be detected; the app reminds
 * allergic members to check the pack for it.
 */
export function applyAllergies(
  allergies: AllergenCode[],
  evidence: AllergenEvidence
): MemberOverlay {
  const flags: FlagReason[] = [];
  const unchecked: UncheckedReason[] = [];
  const checked: TopicCheck[] = [];
  const flaggedTopics: string[] = [];

  for (const code of allergies) {
    const name = ALLERGEN_LABELS[code].toLowerCase();
    const topic = ALLERGEN_LABELS[code];
    const finding = evidence.findings[code];
    if (finding) {
      flaggedTopics.push(topic);
    } else if (evidence.hasIngredientList) {
      checked.push({ topic, for: "allergy" });
    }
    if (finding?.presence === "contains") {
      flags.push({
        kind: "flag",
        severity: "red",
        label: `Contains ${name}`,
        text: finding.ingredient
          ? `Contains ${name} — in the ingredients: "${finding.ingredient}"`
          : `Contains ${name} — declared on the pack`,
        rule_id: `allergen_${code}`,
      });
    } else if (finding?.presence === "may_contain") {
      flags.push({
        kind: "flag",
        severity: "red",
        label: `May contain ${name}`,
        text: `May contain traces of ${name} — not safe with a ${name} allergy`,
        rule_id: `allergen_${code}_may_contain`,
      });
    } else if (!evidence.hasIngredientList) {
      unchecked.push(
        uncheckedReason(
          `Couldn't check for ${name} — no ingredient list`,
          `allergen_${code}`,
          ALLERGEN_LABELS[code]
        )
      );
    }
  }

  return {
    // Something couldn't be checked: Caution at best, never Safe.
    severity: flags.length ? "red" : unchecked.length ? "yellow" : "green",
    flags,
    unchecked,
    checked,
    flaggedTopics,
  };
}
