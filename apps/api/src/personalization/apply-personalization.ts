import type { FlagReason, UncheckedReason } from "@foodscanner/shared";
import {
  checkOperator,
  escalateOneLevel,
  readFact,
  ruleAppliesToForm,
  worstSeverity,
} from "../scoring/evaluate-rules";
import {
  FALLBACK_LABEL,
  checkTopic,
  conditionName,
  factName,
  uncheckedReason,
  type MemberOverlay,
  type TopicCheck,
} from "./member-overlay";
import type {
  ApplyPersonalizationInput,
  ConditionGap,
} from "./personalization.types";

export function applyPersonalization(
  input: ApplyPersonalizationInput
): MemberOverlay {
  const flags: FlagReason[] = [];
  const checked: TopicCheck[] = [];
  const flaggedTopics: string[] = [];
  // Several conditions can share a topic (salt for BP, heart and kidneys):
  // one "not checked" per topic naming all of them, and one flag per topic.
  const gaps = new Map<string, ConditionGap>();
  const productForm = readFact(input.facts, "product_form");

  for (const rule of input.rules) {
    if (!input.memberConditions.includes(rule.condition)) {
      continue; // rule doesn't apply to this member at all — not a data gap
    }
    if (!ruleAppliesToForm(rule, productForm)) {
      continue; // e.g. the per-100g sugar rule on a drink — its twin covers it
    }
    const fact = readFact(input.facts, rule.field);
    const result = checkOperator(
      rule.operator,
      fact,
      rule.threshold,
      rule.value
    );
    const topic = checkTopic(rule.field);

    if (result === "inapplicable") {
      // This condition DOES apply to the member, and we genuinely could
      // not check whether it should have escalated — so for them it can't
      // be Safe (Caution at best, like an allergy we couldn't check).
      const gap = gaps.get(topic) ?? {
        field: rule.field,
        ruleId: rule.id,
        conditions: [],
      };
      const name = conditionName(rule.condition);
      if (!gap.conditions.includes(name)) {
        gap.conditions.push(name);
      }
      gaps.set(topic, gap);
      continue;
    }

    if (result !== "matched") {
      checked.push({ topic, for: conditionName(rule.condition) });
      continue;
    }
    if (flaggedTopics.includes(topic)) {
      continue; // same escalation from the same base — one flag says it
    }
    flaggedTopics.push(topic);

    // "escalate one level" is the only effect. The reason carries the level
    // it escalated to, so it can be the main reason for the verdict it
    // caused — and every escalation gets one.
    flags.push({
      kind: "flag",
      severity: escalateOneLevel(input.base.severity),
      label: rule.label?.trim() || FALLBACK_LABEL.flag,
      text: rule.message,
      rule_id: rule.id,
      field: rule.field,
    });
  }

  const unchecked: UncheckedReason[] = [...gaps].map(([topic, gap]) =>
    uncheckedReason(
      `Couldn't check ${factName(gap.field)} for ${listInWords(gap.conditions)}`,
      gap.ruleId,
      topic
    )
  );

  return {
    severity: worstSeverity([
      input.base.severity,
      ...flags.map((flag) => flag.severity),
      ...(unchecked.length ? (["yellow"] as const) : []),
    ]),
    flags,
    unchecked,
    checked,
    flaggedTopics,
  };
}

/** ["hypertension", "heart disease", "x"] -> "hypertension, heart disease and x". */
function listInWords(items: string[]): string {
  return items.length > 1
    ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
    : (items[0] ?? "");
}
