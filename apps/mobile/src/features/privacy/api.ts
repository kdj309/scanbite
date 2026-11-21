import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, NO_CONTENT } from "@/api/client";
import { clearTokens } from "@/api/token-store";
import { clearSetupSeen } from "@/features/onboarding/setup-seen";

/**
 * "Delete account" (design 13b; App Store 5.1.1(v), Google Play): the API
 * removes the account and everything tied to it, then this phone forgets
 * the session and setup, so starting again is a fresh first open.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await api("/me", NO_CONTENT, { method: "DELETE" });
      await clearTokens();
      await clearSetupSeen();
    },
  });
}

/**
 * "Start again" after deleting: dropping every query (the session too)
 * makes the app open as on a new phone: a new anonymous account, then the
 * welcome.
 */
export function useStartAgain(): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.resetQueries();
}
