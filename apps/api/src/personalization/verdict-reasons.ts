import type { FlagReason, VerdictReason } from "@foodscanner/shared";
import {
  SEVERITY_RANK,
  type EvaluationResult,
} from "../scoring/evaluate-rules";
import {
  FALLBACK_LABEL,
  factName,
  uncheckedReason,
  type MemberOverlay,
} from "./member-overlay";

/**
 * One ordered list for the app (contract: verdictReasonSchema):
 *  1. flags, worst severity first — on a tie a member-specific flag (a
 *     condition rule or an allergy) comes before a general one (sort is
 *     stable and member flags go in first), so reasons[0] is the main reason;
 *  2. then "unchecked" gaps: the member-specific ones always, general
 *     gaps only when the verdict is green (a gap must never hide behind a
 *     "Safe"; next to a flag it adds nothing).
 * `ruleLabels` maps base rule id -> chip text from the active rule set.
 * Gap text is written at serve time, not stored, so it reads as plain words.
 */
export function buildVerdictReasons(input: {
  base: EvaluationResult;
  /** Everything member-specific (conditions, allergies), combined. */
  overlay: MemberOverlay;
  ruleLabels: Record<string, string>;
}): VerdictReason[] {
  const { base, overlay, ruleLabels } = input;

  const generalFlags: FlagReason[] = base.breakdown.map((item) => ({
    kind: "flag",
    severity: item.severity,
    label: ruleLabels[item.rule_id] ?? FALLBACK_LABEL.flag,
    text: item.reason,
    rule_id: item.rule_id,
  }));
  const flags = [...overlay.flags, ...generalFlags].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );

  const generalGaps =
    overlay.severity === "green"
      ? base.unevaluated.map((gap) =>
          uncheckedReason(
            `Couldn't check ${factName(gap.field)}`,
            gap.rule_id,
            ruleLabels[gap.rule_id]
          )
        )
      : [];

  return [...flags, ...overlay.unchecked, ...generalGaps];
}
