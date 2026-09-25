import type { HouseholdMember as HouseholdMemberDto } from "@foodscanner/shared";
import { toIso } from "../common/dates";
import type { HouseholdMemberDocument } from "../database/schemas/household-member.schema";

export function serializeHouseholdMember(
  member: HouseholdMemberDocument,
): HouseholdMemberDto {
  return {
    id: member.id as string,
    name: member.name,
    relationship: member.relationship,
    age_band: member.age_band,
    conditions: member.conditions ?? [],
    allergies: member.allergies ?? [],
    created_at: toIso(member.created_at),
    updated_at: toIso(member.updated_at),
  };
}
