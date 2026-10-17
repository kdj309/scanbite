import type { HouseholdMember } from "@foodscanner/shared";

/** Every account starts with this member: the person using the app. */
export function selfMember(
  members: readonly HouseholdMember[]
): HouseholdMember | undefined {
  return members.find((member) => member.relationship === "self");
}

/** The app calls the self member "You", whatever name it's stored under. */
export function displayName(
  member: Pick<HouseholdMember, "relationship" | "name">
): string {
  return member.relationship === "self" ? "You" : member.name;
}

/**
 * Whether anything was entered about this person. Everyone but "You" has
 * at least a name; "You" exists from the start, so it counts only once an
 * age, condition or allergy was added.
 */
export function hasDetails(member: HouseholdMember): boolean {
  return (
    member.relationship !== "self" ||
    member.age_band !== undefined ||
    member.conditions.length > 0 ||
    member.allergies.length > 0
  );
}
