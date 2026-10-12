import type {
  MemberVerdict,
  ProductFoundResponse,
  Severity,
} from "@foodscanner/shared";
import { SEVERITY_RANK } from "../scoring/evaluate-rules";
import type { NotificationEvent } from "../workers/queue-names";

const SEVERITY_WORDS: Record<Severity, string> = {
  red: "Avoid",
  yellow: "Caution",
  green: "Safe",
};

/** Lock-screen text stays short; the app shows the rest. This also keeps
 *  every notification far under Expo's 4,096-byte limit. */
const MAX_NAMES = 2;
const MAX_PRODUCT_NAME = 60;

export type SubmissionMessage = { title: string; body: string };

/**
 * What a user sees when their photo submission finishes. For a ready
 * product it carries the household verdict, worst first ("Avoid for Papa ·
 * Caution for Amma") — never names someone without a health profile.
 */
export function submissionMessage(
  event: NotificationEvent,
  result: ProductFoundResponse | null
): SubmissionMessage {
  if (event === "failed") {
    return {
      title: "We couldn't read those photos",
      body: "Try again with the label flat and well lit.",
    };
  }
  if (event === "needs_review" || !result) {
    return {
      title: "Thanks for adding a product",
      body: "We're taking a closer look at the label and will let you know.",
    };
  }
  return {
    title: `${shorten(result.product.name, MAX_PRODUCT_NAME)} is ready`,
    body: householdSummary(result.members),
  };
}

function householdSummary(members: MemberVerdict[]): string {
  const checked = members.filter((member) => member.has_health_profile);
  if (checked.length === 0) {
    return "Tap to see what's in it.";
  }
  const flagged = checked
    .filter((member) => member.verdict.severity !== "green")
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.verdict.severity] - SEVERITY_RANK[a.verdict.severity]
    );
  if (flagged.length === 0) {
    return `Safe for ${names(checked.map((member) => member.name))}`;
  }
  const shown = flagged
    .slice(0, MAX_NAMES)
    .map((m) => `${SEVERITY_WORDS[m.verdict.severity]} for ${m.name}`);
  const more = flagged.length - shown.length;
  return [...shown, ...(more > 0 ? [`+${more} more`] : [])].join(" · ");
}

/** "Papa", "Amma & Papa", "Amma, Papa & 2 more". */
function names(list: string[]): string {
  if (list.length <= MAX_NAMES) {
    return list.join(" & ");
  }
  return `${list.slice(0, MAX_NAMES).join(", ")} & ${list.length - MAX_NAMES} more`;
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
