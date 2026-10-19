import type { HouseholdMember } from "@foodscanner/shared";
import { router } from "expo-router";

/** The ✎ button's screen-reader label. */
export function editLabel(member: HouseholdMember): string {
  return member.relationship === "self"
    ? "Edit your profile"
    : `Edit ${member.name}`;
}

export function openEdit(member: HouseholdMember) {
  router.push({ pathname: "/family/[id]", params: { id: member.id } });
}
