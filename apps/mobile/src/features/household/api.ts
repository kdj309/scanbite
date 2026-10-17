import {
  householdMemberSchema,
  listHouseholdMembersResponseSchema,
  type CreateHouseholdMemberRequest,
  type HouseholdMember,
  type UpdateHouseholdMemberRequest,
} from "@foodscanner/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export const householdQueryKey = ["household"] as const;

/** Everyone in the household, in the order they were added. */
export function useHousehold() {
  return useQuery({
    queryKey: householdQueryKey,
    queryFn: () =>
      api("/household-members", listHouseholdMembersResponseSchema),
  });
}

export function createMember(
  body: CreateHouseholdMemberRequest
): Promise<HouseholdMember> {
  return api("/household-members", householdMemberSchema, {
    method: "POST",
    body,
  });
}

export function updateMember(
  id: string,
  body: UpdateHouseholdMemberRequest
): Promise<HouseholdMember> {
  return api(`/household-members/${id}`, householdMemberSchema, {
    method: "PATCH",
    body,
  });
}

/** Removes someone from the household ("You" can't be removed). */
export function deleteMember(id: string): Promise<void> {
  return api(`/household-members/${id}`, NO_CONTENT, { method: "DELETE" });
}

/** A 204 has no body to parse. */
const NO_CONTENT = { parse: (): void => undefined };
