import { randomUUID } from "expo-crypto";
import { hasDetails } from "@/features/household/members";
import type { AgeBand } from "@/features/household/profile-options";
import type {
  AllergenCode,
  HouseholdMember,
  CreateHouseholdMemberRequest,
  HealthConditionCode,
  Relationship,
  UpdateHouseholdMemberRequest,
} from "@foodscanner/shared";
import type { WhoOption } from "./add-person.types";

/**
 * "Who do you shop for?" tiles. One tile is one person; anyone else (a
 * second parent, a second child) is added later from the Family screen.
 */
export const WHO_OPTIONS: readonly WhoOption[] = [
  { relationship: "self", title: "Me", subtitle: "Just me", initials: "Me" },
  {
    relationship: "spouse",
    title: "Partner",
    subtitle: "Husband or wife",
    icon: "heart",
  },
  {
    relationship: "parent",
    title: "Parent",
    subtitle: "Mom, Dad, in-law",
    initials: "P",
  },
  { relationship: "child", title: "Child", subtitle: "Any age", initials: "K" },
  {
    relationship: "other",
    title: "Someone else",
    subtitle: "Grandparent, helper",
    initials: "+",
  },
];

/** The person being set up, until their last step saves them. */
export type DraftPerson = {
  relationship: Relationship;
  /** Optional for "Me". */
  name: string;
  ageBand?: AgeBand;
  conditions: HealthConditionCode[];
  allergies: AllergenCode[];
  /** Made once when drafted and sent with the create, so a retried save
   *  (its response lost) updates this person instead of adding them twice. */
  clientId: string;
};

export function newPerson(relationship: Relationship): DraftPerson {
  return {
    relationship,
    name: "",
    conditions: [],
    allergies: [],
    clientId: randomUUID(),
  };
}

/** Relationships that are one person: never offered twice. */
const ONE_PERSON: ReadonlySet<Relationship> = new Set(["self", "spouse"]);

/**
 * What "Add family member" offers: never "Me" (you're always in), and no
 * other one-person choice that's already taken (a second partner).
 */
export function addOptions(
  members: readonly HouseholdMember[]
): typeof WHO_OPTIONS {
  return WHO_OPTIONS.filter(
    ({ relationship }) =>
      relationship !== "self" &&
      !(
        ONE_PERSON.has(relationship) &&
        members.some((member) => member.relationship === relationship)
      )
  );
}

/**
 * Who's in the family so far, by relationship: their tiles show "Added"
 * with an edit button. "You" counts once something about you was added.
 */
export function addedPeople(
  members: readonly HouseholdMember[]
): Map<Relationship, HouseholdMember[]> {
  const added = new Map<Relationship, HouseholdMember[]>();
  for (const member of members) {
    if (hasDetails(member)) {
      added.set(member.relationship, [
        ...(added.get(member.relationship) ?? []),
        member,
      ]);
    }
  }
  return added;
}

/** What Bitey says and the title, per step, for this person. */
export function stepCopy(person: DraftPerson) {
  const self = person.relationship === "self";
  const name = person.name.trim() || "them";
  return {
    aboutTitle: self ? "Tell me about you" : "Tell me about them",
    aboutSay: self
      ? "What should I call you? Your name is optional. Roughly how old are you?"
      : "What do you call them, and roughly how old are they?",
    conditionsTitle: self
      ? "Do you have any of these?"
      : `Does ${name} have any of these?`,
    conditionsSay: "Pick all that apply. Most families have more than one.",
    allergiesTitle: "Any allergies?",
    allergiesSay: self
      ? "Any food allergies? Skip if none."
      : `Any food allergies for ${name}? Skip if none.`,
  };
}

type SaveRequest =
  | { kind: "update"; id: string; body: UpdateHouseholdMemberRequest }
  | { kind: "create"; body: CreateHouseholdMemberRequest };

/**
 * "Me" updates the member every account starts with; anyone else is
 * created (a retry with the same client id updates instead of duplicating).
 */
export function saveRequest(person: DraftPerson, selfId: string): SaveRequest {
  const profile = {
    age_band: person.ageBand,
    conditions: person.conditions,
    allergies: person.allergies,
  };
  if (person.relationship === "self") {
    // Optional for you: left empty, your member keeps its default name.
    const name = person.name.trim();
    return {
      kind: "update",
      id: selfId,
      body: name ? { ...profile, name } : profile,
    };
  }
  return {
    kind: "create",
    body: {
      ...profile,
      name: person.name.trim(),
      relationship: person.relationship,
      client_id: person.clientId,
    },
  };
}
