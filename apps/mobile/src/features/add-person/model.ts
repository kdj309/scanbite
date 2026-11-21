import { randomUUID } from "expo-crypto";
import { hasDetails } from "@/features/household/members";
import type { AgeBand } from "@/features/household/profile-options";
import type {
  AllergenCode,
  HouseholdMember,
  CreateHouseholdMemberRequest,
  HealthConditionCode,
  MemberConsentBasis,
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
  /**
   * The statement ticked on their conditions step (design 8c), not just
   * yes/no: if the age later changes what's being confirmed (guardian vs
   * agreed), the old tick no longer counts. Not asked for "Me".
   */
  permissionFor: MemberConsentBasis | null;
};

export function newPerson(relationship: Relationship): DraftPerson {
  return {
    relationship,
    name: "",
    conditions: [],
    allergies: [],
    clientId: randomUUID(),
    permissionFor: null,
  };
}

/** Under 18: a parent's or guardian's consent (DPDP Act 2023). */
const CHILD_AGE_BANDS: ReadonlySet<AgeBand> = new Set(["0–12", "13–17"]);

/**
 * Why we may hold this person's details (design 8c): a child needs their
 * parent or guardian; an adult needs to have agreed. A "Child" with no age
 * given counts as a child: the stricter reading.
 */
export function consentBasis(person: DraftPerson): MemberConsentBasis {
  if (person.ageBand) {
    return CHILD_AGE_BANDS.has(person.ageBand) ? "guardian" : "member_agreed";
  }
  return person.relationship === "child" ? "guardian" : "member_agreed";
}

/** Ticked for what's being confirmed now (it changes with their age). */
export function hasPermission(person: DraftPerson): boolean {
  return person.permissionFor === consentBasis(person);
}

/** The tick's words: "I'm Aarav's parent or guardian". */
export function permissionText(person: DraftPerson): string {
  const name = person.name.trim();
  if (consentBasis(person) === "guardian") {
    return name
      ? `I'm ${name}'s parent or guardian`
      : "I'm their parent or guardian";
  }
  return name
    ? `${name} has agreed to me adding their health info`
    : "They've agreed to me adding their health info";
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
      // Only what they confirmed; without it the server refuses the save.
      consent_basis: hasPermission(person) ? consentBasis(person) : undefined,
    },
  };
}
