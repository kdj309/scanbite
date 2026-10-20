import type { HouseholdMember } from "@foodscanner/shared";
import { healthChecks } from "@/features/household/members";
import { joinNames, sentenceName } from "@/features/scans/recent";

/**
 * The scan card's words for who scans are checked for (people with
 * conditions or allergies): nobody yet, one person, or the family.
 */
export function scanCardCopy(checked: readonly HouseholdMember[]): {
  title: string;
  subtitle: string;
} {
  if (checked.length === 0) {
    return { title: "Scan a product", subtitle: "Point at the barcode" };
  }
  if (checked.length === 1) {
    const [member] = checked;
    return {
      title: `Scan for ${sentenceName(member)}`,
      subtitle: `Checks ${possessive(member)} ${joinNames(healthChecks(member))}`,
    };
  }
  return {
    title: "Scan for everyone",
    subtitle:
      checked.length > 2
        ? `One scan checks all ${checked.length} of you together`
        : `One scan checks ${joinNames(checked.map(sentenceName))} together`,
  };
}

function possessive(member: HouseholdMember): string {
  return member.relationship === "self" ? "your" : `${member.name}'s`;
}
