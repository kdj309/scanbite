import type { Check } from "@foodscanner/shared";
import type { EvaluationResult, PassedRule } from "../scoring/evaluate-rules";
import {
  checkTopic,
  type MemberOverlay,
  type TopicCheck,
} from "./member-overlay";

/**
 * "What we checked" for one member: every topic a general rule, one of
 * their condition rules or one of their allergies checked and passed —
 * grouped by topic, with what it was also checked for. A topic flagged by
 * any rule is left out: "Sugar ✓" next to "High sugar" would contradict.
 */
export function whatWeChecked(input: {
  basePassed: PassedRule[];
  base: Pick<EvaluationResult, "breakdown">;
  ruleLabels: Record<string, string>;
  overlay: Pick<MemberOverlay, "checked" | "flaggedTopics">;
}): Check[] {
  const { basePassed, base, ruleLabels, overlay } = input;
  const flagged = new Set([
    ...base.breakdown.map((item) =>
      checkTopic(item.field, ruleLabels[item.rule_id])
    ),
    ...overlay.flaggedTopics,
  ]);

  const passed: TopicCheck[] = [
    ...basePassed.map((rule) => ({
      topic: checkTopic(rule.field, rule.label),
    })),
    ...overlay.checked,
  ];
  const byTopic = new Map<string, Set<string>>();
  for (const check of passed) {
    if (flagged.has(check.topic)) {
      continue;
    }
    const reasons = byTopic.get(check.topic) ?? new Set<string>();
    if (check.for) {
      reasons.add(check.for);
    }
    byTopic.set(check.topic, reasons);
  }

  return [...byTopic].map(([label, reasons]) => ({ label, for: [...reasons] }));
}
