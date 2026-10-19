import type {
  AllergenCode,
  HealthConditionCode,
  HouseholdMember,
  UpdateHouseholdMemberRequest,
} from "@foodscanner/shared";
import { ownName, UNNAMED_SELF } from "./members";
import { AGE_BANDS, type AgeBand } from "./profile-options";

/** What the edit screen lets you change about one person. */
export type MemberForm = {
  name: string;
  ageBand?: AgeBand;
  conditions: HealthConditionCode[];
  allergies: AllergenCode[];
};

export function formFromMember(member: HouseholdMember): MemberForm {
  return {
    name: ownName(member) ?? "",
    ageBand: AGE_BANDS.find((band) => band === member.age_band),
    conditions: member.conditions,
    allergies: member.allergies,
  };
}

/** The update to send. Your own name is optional: clearing it unnames you. */
export function editRequest(
  member: Pick<HouseholdMember, "relationship">,
  form: MemberForm
): UpdateHouseholdMemberRequest {
  const name = form.name.trim();
  return {
    name: member.relationship === "self" ? name || UNNAMED_SELF : name,
    age_band: form.ageBand,
    conditions: form.conditions,
    allergies: form.allergies,
  };
}
