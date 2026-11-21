import {
  householdMemberSchema,
  type ListHouseholdMembersResponse,
  listHouseholdMembersResponseSchema,
  type CreateHouseholdMemberRequest,
  type HouseholdMember,
  type UpdateHouseholdMemberRequest,
} from "@foodscanner/shared";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { api, NO_CONTENT } from "@/api/client";
import { productsQueryKey } from "@/features/verdict/api";
import { withMember, withoutMember } from "./members";

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

/**
 * After a save, show the person the API returned straight away, then
 * reload in the background: a reload that fails (bad signal) mustn't
 * leave the old list on screen.
 */
export function showSavedMember(
  queryClient: QueryClient,
  member: HouseholdMember
) {
  updateHousehold(queryClient, (members) => withMember(members, member));
}

/** After a removal: drop them now, then reload in the background. */
export function showRemovedMember(queryClient: QueryClient, id: string) {
  updateHousehold(queryClient, (members) => withoutMember(members, id));
}

function updateHousehold(
  queryClient: QueryClient,
  change: (members: HouseholdMember[]) => HouseholdMember[]
) {
  queryClient.setQueryData<ListHouseholdMembersResponse>(
    householdQueryKey,
    (household) => household && { members: change(household.members) }
  );
  void queryClient.invalidateQueries({ queryKey: householdQueryKey });
  // Conditions changed, so verdicts did too (an open verdict refetches).
  void queryClient.invalidateQueries({ queryKey: productsQueryKey });
}
