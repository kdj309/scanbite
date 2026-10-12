import type { CatalogItem } from "@foodscanner/shared";
import {
  GENERAL_MEMBER,
  householdVerdict,
  verdictFor,
  type HouseholdMemberInput,
  type ProductContext,
} from "../personalization/household-verdict";

/**
 * One Explore row for the included members (none = general verdict):
 * the overall verdict and whose it is, a ring per member, and the one chip —
 * the main reason behind the worst verdict (a flag, or what we couldn't
 * check).
 */
export function catalogEntry(
  context: ProductContext,
  included: HouseholdMemberInput[]
): Pick<CatalogItem, "overall" | "members" | "main_reason"> {
  const { overall, members } = householdVerdict(context, included);
  const driver = members.find((m) => m.member_id === overall.member_id);
  const main = (driver?.verdict ?? verdictFor(context, GENERAL_MEMBER))
    .reasons[0];
  return {
    overall,
    members: members.map((m) => ({
      member_id: m.member_id,
      severity: m.verdict.severity,
    })),
    main_reason: main
      ? { kind: main.kind, label: main.label, rule_id: main.rule_id }
      : null,
  };
}
