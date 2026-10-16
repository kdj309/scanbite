import {
  focusManager,
  onlineManager,
  QueryClient,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState, Platform } from "react-native";
import { ApiError, SessionExpiredError } from "@/api/client";

/** A 4xx or an expired session fails the same way every time. */
export function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof SessionExpiredError) {
    return false;
  }
  if (error instanceof ApiError && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetry } },
});

/** Pause queries offline and resume when the phone reconnects. */
onlineManager.setEventListener((setOnline) => {
  let initialised = false;
  const subscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    setOnline(!!state.isConnected);
  });
  Network.getNetworkStateAsync()
    .then((state) => {
      if (!initialised) {
        setOnline(!!state.isConnected);
      }
    })
    .catch(() => {});
  return subscription.remove;
});

/** Refetch stale data when the app comes back to the foreground. */
AppState.addEventListener("change", (status) => {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
});
