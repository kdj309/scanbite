import type { HouseholdMember, Relationship } from "@foodscanner/shared";

/** Every account starts with this member: the person using the app. */
export function selfMember(
  members: readonly HouseholdMember[]
): HouseholdMember | undefined {
  return members.find((member) => member.relationship === "self");
}

/** What every account's self member is called until you name yourself. */
export const UNNAMED_SELF = "Self";

/** The name someone chose, or undefined while you haven't named yourself. */
export function ownName(
  member: Pick<HouseholdMember, "relationship" | "name">
): string | undefined {
  return member.relationship === "self" && member.name === UNNAMED_SELF
    ? undefined
    : member.name;
}

/** For sentences ("Avoid for you"): you're always "You". */
export function displayName(
  member: Pick<HouseholdMember, "relationship" | "name">
): string {
  return member.relationship === "self" ? "You" : member.name;
}

/** For lists and cards: "Kartik (you)", or "You" while unnamed. */
export function listName(
  member: Pick<HouseholdMember, "relationship" | "name">
): string {
  if (member.relationship !== "self") {
    return member.name;
  }
  const own = ownName(member);
  return own ? `${own} (you)` : "You";
}

/**
 * Whether anything was entered about this person. Everyone but "You" has
 * at least a name; "You" exists from the start, so it counts only once a
 * name, age, condition or allergy was added.
 */
export function hasDetails(member: HouseholdMember): boolean {
  return (
    ownName(member) !== undefined ||
    member.age_band !== undefined ||
    member.conditions.length > 0 ||
    member.allergies.length > 0
  );
}

/**
 * Whether scans can check anything personal for them: a condition or an
 * allergy (the API's "health profile"). Age alone doesn't change verdicts.
 */
export function hasHealthProfile(
  member: Pick<HouseholdMember, "conditions" | "allergies">
): boolean {
  return member.conditions.length > 0 || member.allergies.length > 0;
}

/** The Family header: how many people scans are personal for, and who's next. */
export function familyProgress(members: readonly HouseholdMember[]): {
  done: number;
  total: number;
  /** The first person with nothing to check yet, if any. */
  next: HouseholdMember | undefined;
} {
  return {
    done: members.filter(hasHealthProfile).length,
    total: members.length,
    next: members.find((member) => !hasHealthProfile(member)),
  };
}

/** A name is required for everyone except you. */
export function nameMissing(relationship: Relationship, name: string): boolean {
  return relationship !== "self" && name.trim() === "";
}

/** The family with this person added, or replaced if they're already in it. */
export function withMember(
  members: readonly HouseholdMember[],
  member: HouseholdMember
): HouseholdMember[] {
  return members.some((m) => m.id === member.id)
    ? members.map((m) => (m.id === member.id ? member : m))
    : [...members, member];
}

/** The family without this person. */
export function withoutMember(
  members: readonly HouseholdMember[],
  id: string
): HouseholdMember[] {
  return members.filter((m) => m.id !== id);
}
