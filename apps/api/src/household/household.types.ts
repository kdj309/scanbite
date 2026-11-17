import type { HouseholdMember } from "../database/schemas/household-member.schema";

/** What a create request sets on a member, with lists defaulted to empty. */
export type MemberFields = Pick<
  HouseholdMember,
  "name" | "relationship" | "age_band" | "conditions" | "allergies"
>;
