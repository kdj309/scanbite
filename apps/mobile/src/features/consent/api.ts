import {
  HEALTH_CONSENT_NOTICE_VERSION,
  meResponseSchema,
  type MeResponse,
} from "@foodscanner/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

export const meQueryKey = ["me"] as const;

/** POST /me/health-consent answers with the updated user. */
const consentResponseSchema = meResponseSchema.pick({ user: true });

/** The signed-in account: who they are, and what they've agreed to. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api("/me", meResponseSchema),
    // Changes only when they agree (cached by the mutation), so guarded
    // screens don't each wait for a fresh copy.
    staleTime: 5 * 60_000,
  });
}

/** Agreed to the current health-info notice; an older one asks again. */
export function hasHealthConsent(me: MeResponse | undefined): boolean {
  return (
    me?.user.health_consent?.notice_version === HEALTH_CONSENT_NOTICE_VERSION
  );
}

/** "I agree" on the health-info notice (design 0b). */
export function useAgreeToHealthInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api("/me/health-consent", consentResponseSchema, {
        method: "POST",
        body: { notice_version: HEALTH_CONSENT_NOTICE_VERSION },
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<MeResponse>(meQueryKey, (me) =>
        me ? { ...me, user } : me
      );
    },
  });
}
