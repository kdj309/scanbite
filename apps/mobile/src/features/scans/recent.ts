import type { HouseholdMember, Scan, Severity } from "@foodscanner/shared";
import { hasHealthProfile } from "@/features/household/members";

const SEVERITY_WORDS: Record<Severity, string> = {
  green: "Safe",
  yellow: "Caution",
  red: "Avoid",
};

const RANK: Record<Severity, number> = { green: 0, yellow: 1, red: 2 };

/** Someone a scan checked personally, and their verdict at the time. */
export type CheckedVerdict = { member: HouseholdMember; severity: Severity };

/**
 * The verdicts that were personal: people who have conditions or allergies
 * (anyone else got the general verdict). Someone added after the scan
 * wasn't checked, so isn't listed.
 */
export function checkedVerdicts(
  scan: Scan,
  members: readonly HouseholdMember[]
): CheckedVerdict[] {
  return members.filter(hasHealthProfile).flatMap((member) => {
    const verdict = scan.verdicts.find((v) => v.member_id === member.id);
    return verdict ? [{ member, severity: verdict.severity }] : [];
  });
}

/** The row's colour: the worst personal verdict, else the general one. */
export function scanSeverity(
  scan: Scan,
  checked: readonly CheckedVerdict[]
): Severity | null {
  if (checked.length === 0) {
    return scan.severity;
  }
  return checked.reduce<Severity>(
    (worst, { severity }) => (RANK[severity] > RANK[worst] ? severity : worst),
    "green"
  );
}

/** Rings shown on a row; the rest fold into "+N" (design 1c). */
const MAX_RINGS = 2;

/** The worst verdicts as rings, and how many more people there are. */
export function ringsFor(checked: readonly CheckedVerdict[]): {
  shown: CheckedVerdict[];
  more: number;
} {
  const worstFirst = [...checked].sort(
    (a, b) => RANK[b.severity] - RANK[a.severity]
  );
  return {
    shown: worstFirst.slice(0, MAX_RINGS),
    more: Math.max(0, worstFirst.length - MAX_RINGS),
  };
}

/** "Avoid for Papa · Caution for Amma", worst first. */
export function scanSummary(
  scan: Scan,
  checked: readonly CheckedVerdict[]
): string {
  if (!scan.found || scan.severity === null) {
    return "Not found";
  }
  if (checked.length === 0) {
    return `${SEVERITY_WORDS[scan.severity]} in general`;
  }
  const parts = (["red", "yellow"] as const).flatMap((severity) => {
    const names = checked
      .filter((verdict) => verdict.severity === severity)
      .map(({ member }) => sentenceName(member));
    if (names.length === 0) {
      return [];
    }
    return [`${SEVERITY_WORDS[severity]} for ${who(names, checked.length)}`];
  });
  if (parts.length > 0) {
    return parts.join(" · ");
  }
  return checked.length === 1
    ? `Safe for ${sentenceName(checked[0].member)}`
    : "Safe for everyone";
}

/** "Papa", "both", "everyone" or "Amma & Papa". */
function who(names: string[], checkedCount: number): string {
  if (names.length === checkedCount && checkedCount > 1) {
    return checkedCount === 2 ? "both" : "everyone";
  }
  return joinNames(names, "&");
}

/** Mid-sentence: "for you", "for Papa". */
export function sentenceName(
  member: Pick<HouseholdMember, "relationship" | "name">
): string {
  return member.relationship === "self" ? "you" : member.name;
}

/** "Amma", "Amma and Papa", "Amma, Papa and you". */
export function joinNames(names: readonly string[], and = "and"): string {
  return names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Just now", "5 min ago", "3 hr ago", "Yesterday", "12 Oct". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const days = calendarDaysBetween(then, now);
  if (days === 0) {
    return `${Math.floor(minutes / 60)} hr ago`;
  }
  if (days === 1) {
    return "Yesterday";
  }
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}

function calendarDaysBetween(earlier: Date, later: Date): number {
  const day = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((day(later) - day(earlier)) / 86_400_000);
}
