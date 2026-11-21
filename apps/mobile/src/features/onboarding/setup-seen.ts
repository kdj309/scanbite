import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import * as SecureStore from "expo-secure-store";

/**
 * Whether family setup was finished or skipped on this phone, so the
 * welcome isn't shown on every launch. Kept next to the session tokens:
 * both survive or go together.
 */
const KEY = "scanbite.setup-seen";

export const setupSeenQueryKey = ["setup-seen"] as const;

export function useSetupSeen() {
  return useQuery({
    queryKey: setupSeenQueryKey,
    queryFn: async () => (await SecureStore.getItemAsync(KEY)) === "true",
    staleTime: Infinity,
  });
}

/**
 * Setup is done (finished, or skipped with "I'll just scan"): remember it
 * and go on. One place, so every way out behaves the same.
 */
export function useFinishSetup(): (next: Href) => Promise<void> {
  const queryClient = useQueryClient();
  return async (next) => {
    await SecureStore.setItemAsync(KEY, "true");
    queryClient.setQueryData(setupSeenQueryKey, true);
    router.replace(next);
  };
}

/** Development only: show setup again (the family stays saved). */
export function clearSetupSeen(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY);
}
