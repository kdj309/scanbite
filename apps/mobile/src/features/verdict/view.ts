import type {
  HouseholdMember,
  MemberVerdict,
  ProductFoundResponse,
  Severity,
  VerdictReason,
} from "@foodscanner/shared";
import { SEVERITY_WORDS, type VerdictTone } from "@/components";
import { healthChecks } from "@/features/household/members";
import {
  joinNames,
  sentenceName,
  verdictSummary,
} from "@/features/scans/recent";

/** Everyone together, or one person's id. */
export const ALL = "all";

/** Each row's mark: passed, or the flag's own severity. */
export type MoreItem = { title: string; detail: string; tone: "ok" | Severity };

/** What the verdict screen shows for whoever is selected (design S2/S5). */
export type VerdictView = {
  severity: VerdictTone;
  badge: string;
  checkedFor: string;
  reasonLabel: string;
  title: string;
  line: string;
  /** The main reason's rule, for "Why does this matter?". */
  whyRuleId?: string;
  more: { title: string; items: MoreItem[] };
  /** Set when nothing personal was checked: who to add conditions for. */
  addConditionsFor?: HouseholdMember;
  /** Avoid or Caution: offer better options, not buy links. */
  flagged: boolean;
};

export type PersonOption = {
  id: string;
  name: string;
  severity: VerdictTone;
};

/** One person's verdict, with their household member. */
type Person = { member: HouseholdMember; verdict: MemberVerdict };

function people(
  result: ProductFoundResponse,
  members: readonly HouseholdMember[]
): Person[] {
  return result.members.flatMap((verdict) => {
    const member = members.find((m) => m.id === verdict.member_id);
    return member ? [{ member, verdict }] : [];
  });
}

/**
 * Who the screen opens on: whoever it was scanned for, else the person it's
 * worst for (no tap needed), else everyone when it's fine for all.
 */
export function defaultSelection(
  result: ProductFoundResponse,
  scannedFor: string | undefined
): string {
  if (scannedFor && result.members.some((m) => m.member_id === scannedFor)) {
    return scannedFor;
  }
  return result.overall.severity !== "green" && result.overall.member_id
    ? result.overall.member_id
    : ALL;
}

/** "See it for": All, then everyone in household order. */
export function personOptions(
  result: ProductFoundResponse,
  members: readonly HouseholdMember[]
): PersonOption[] {
  return [
    { id: ALL, name: "All", severity: result.overall.severity },
    ...people(result, members).map(({ member, verdict }): PersonOption => ({
      id: member.id,
      name: member.relationship === "self" ? "You" : member.name,
      severity: verdict.has_health_profile ? verdict.verdict.severity : "none",
    })),
  ];
}

export function verdictView(
  result: ProductFoundResponse,
  members: readonly HouseholdMember[],
  selected: string
): VerdictView {
  const everyone = people(result, members);
  const person = everyone.find(({ member }) => member.id === selected);
  if (person) {
    return person.verdict.has_health_profile
      ? personView(person)
      : notCheckedView(person);
  }
  const checked = everyone.filter(({ verdict }) => verdict.has_health_profile);
  if (checked.length === 0) {
    return generalView(result, everyone);
  }
  return allView(result, checked);
}

const isFlag = (reason: VerdictReason) => reason.kind === "flag";

/** A flag keeps its severity; a gap we couldn't check reads as caution. */
function asItem(reason: VerdictReason): MoreItem {
  return {
    title: reason.label,
    detail: reason.text,
    tone: reason.kind === "flag" ? reason.severity : "yellow",
  };
}

function personView({ member, verdict }: Person): VerdictView {
  const { severity, reasons } = verdict.verdict;
  const name = sentenceName(member);
  const checks = healthChecks(member);
  const base = {
    severity,
    badge: `${SEVERITY_WORDS[severity]} for ${name}`,
    checkedFor: `Checked for ${name} · ${shortList(checks)}`,
  };
  const [main, ...rest] = reasons;
  if (main && isFlag(main)) {
    return {
      ...base,
      reasonLabel: "Main reason",
      title: main.label,
      line: main.text,
      whyRuleId: main.rule_id,
      more: { title: "Also flagged", items: rest.map(asItem) },
      flagged: true,
    };
  }
  return {
    ...base,
    reasonLabel: "Result",
    title: "Nothing flagged",
    line: `Nothing here conflicts with ${possessive(member)} ${joinNames(checks)}.`,
    more: whatWeChecked(verdict),
    flagged: false,
  };
}

function notCheckedView({ member, verdict }: Person): VerdictView {
  const self = member.relationship === "self";
  return {
    severity: "none",
    badge: self ? "Analyze for you" : `Analyze for ${member.name}`,
    checkedFor: `Not checked for ${sentenceName(member)} yet`,
    reasonLabel: "Personal check",
    title: "No conditions added yet",
    line: self
      ? "Tell me about your health and I’ll check this for you too."
      : `Add ${member.name}’s conditions and I’ll check this for them too.`,
    more: {
      title: "General check",
      items: verdict.verdict.reasons.map(asItem),
    },
    addConditionsFor: member,
    flagged: verdict.verdict.severity !== "green",
  };
}

/** Nobody has conditions yet: the general verdict, and a nudge to set up. */
function generalView(
  result: ProductFoundResponse,
  everyone: readonly Person[]
): VerdictView {
  const severity = result.overall.severity;
  // Without conditions everyone gets the same, general verdict.
  const reasons = everyone[0]?.verdict.verdict.reasons ?? [];
  const [main, ...rest] = reasons;
  const self = everyone.find(({ member }) => member.relationship === "self");
  return {
    severity,
    badge: `${SEVERITY_WORDS[severity]} in general`,
    checkedFor: "Not checked for your family yet",
    reasonLabel: "General check",
    title: main && isFlag(main) ? main.label : "Nothing flagged",
    line: main && isFlag(main) ? main.text : "Nothing of general concern.",
    whyRuleId: main && isFlag(main) ? main.rule_id : undefined,
    more: { title: "Also flagged", items: rest.map(asItem) },
    addConditionsFor: self?.member,
    flagged: severity !== "green",
  };
}

function allView(
  result: ProductFoundResponse,
  checked: readonly Person[]
): VerdictView {
  const severity = result.overall.severity;
  const names = checked.map(({ member }) => sentenceName(member));
  const base = {
    severity,
    badge: verdictSummary(
      checked.map(({ member, verdict }) => ({
        member,
        severity: verdict.verdict.severity,
      }))
    ),
    checkedFor:
      checked.length > 2
        ? `Checked for ${checked.length} people`
        : `Checked for ${joinNames(names, "&")}`,
  };
  const worst =
    checked.find(({ member }) => member.id === result.overall.member_id) ??
    checked[0];
  const main = worst.verdict.verdict.reasons.find(isFlag);
  if (severity === "green" || !main) {
    return {
      ...base,
      reasonLabel: "Result",
      title: "Nothing flagged",
      line: "Good to buy for the family.",
      more: {
        title: "What we checked",
        items: unique(
          checked.flatMap(({ verdict }) => whatWeChecked(verdict).items)
        ),
      },
      flagged: false,
    };
  }
  return {
    ...base,
    reasonLabel: "Biggest concern",
    title: main.label,
    line: main.text,
    whyRuleId: main.rule_id,
    more: { title: "Also flagged", items: alsoFlagged(checked, main.rule_id) },
    flagged: true,
  };
}

/** Every other flag across the family, once each: "Caution for Amma". */
function alsoFlagged(
  checked: readonly Person[],
  mainRuleId: string
): MoreItem[] {
  const byRule = new Map<
    string,
    { label: string; worst: Severity; names: string[] }
  >();
  for (const { member, verdict } of checked) {
    for (const reason of verdict.verdict.reasons) {
      if (reason.kind !== "flag" || reason.rule_id === mainRuleId) {
        continue;
      }
      const entry = byRule.get(reason.rule_id) ?? {
        label: reason.label,
        worst: reason.severity,
        names: [],
      };
      if (reason.severity === "red") {
        entry.worst = "red";
      }
      entry.names.push(sentenceName(member));
      byRule.set(reason.rule_id, entry);
    }
  }
  return [...byRule.values()].map(({ label, worst, names }) => ({
    title: label,
    detail: `${SEVERITY_WORDS[worst]} for ${joinNames(names, "&")}`,
    tone: worst,
  }));
}

/** Safe: what passed, then anything we couldn't check. */
function whatWeChecked(verdict: MemberVerdict): VerdictView["more"] {
  return {
    title: "What we checked",
    items: [
      ...verdict.verdict.checked.map((check) => ({
        title: check.label,
        detail:
          check.for.length > 0
            ? `Fine for ${check.for.join(", ")}`
            : "Within limits",
        tone: "ok" as const,
      })),
      ...verdict.verdict.reasons.map(asItem),
    ],
  };
}

function unique(items: MoreItem[]): MoreItem[] {
  return items.filter(
    (item, i) => items.findIndex((other) => other.title === item.title) === i
  );
}

/** "Sugar, BP +4": two, then a count, so the chip stays one line. */
function shortList(items: readonly string[]): string {
  const shown = items.slice(0, 2).join(", ");
  return items.length > 2 ? `${shown} +${items.length - 2}` : shown;
}

function possessive(member: HouseholdMember): string {
  return member.relationship === "self" ? "your" : `${member.name}’s`;
}
