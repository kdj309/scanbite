import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { signInAnonymously } from "@/api/client";
import { API_BASE_URL } from "@/api/config";
import { readTokens } from "@/api/token-store";
import type { SessionProviderProps } from "./session.types";

/** The stored session, or a new anonymous account on first open. */
async function ensureSession(): Promise<true> {
  if (!(await readTokens())) {
    await signInAnonymously();
  }
  return true;
}

/**
 * Makes sure there is a session before any screen renders, so the
 * household is saved from the first scan (no sign-up before scanning).
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ensureSession,
    staleTime: Infinity,
    // Show "Try again" quickly; the user can retry themselves.
    retry: 1,
  });

  if (session.isSuccess) {
    return children;
  }
  return (
    <View style={styles.center}>
      {session.isError ? (
        <>
          <Text>Can&apos;t reach ScanBite right now.</Text>
          {__DEV__ && (
            <Text style={styles.detail}>
              {API_BASE_URL}
              {"\n"}
              {session.error.message}
            </Text>
          )}
          <Button title="Try again" onPress={() => void session.refetch()} />
        </>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  detail: { color: "#5E5668", fontSize: 12, textAlign: "center" },
});
