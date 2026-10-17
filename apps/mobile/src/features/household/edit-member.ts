import type {
  AllergenCode,
  HealthConditionCode,
  HouseholdMember,
  UpdateHouseholdMemberRequest,
} from "@foodscanner/shared";
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
    name: member.name,
    ageBand: AGE_BANDS.find((band) => band === member.age_band),
    conditions: member.conditions,
    allergies: member.allergies,
  };
}

/** The update to send. "You" has no editable name (it's shown as "You"). */
export function editRequest(
  member: Pick<HouseholdMember, "relationship">,
  form: MemberForm
): UpdateHouseholdMemberRequest {
  return {
    ...(member.relationship !== "self" && { name: form.name.trim() }),
    age_band: form.ageBand,
    conditions: form.conditions,
    allergies: form.allergies,
  };
}
