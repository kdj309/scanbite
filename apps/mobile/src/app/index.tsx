import { useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text } from "@/components";
import {
  clearSetupSeen,
  setupSeenQueryKey,
  useSetupSeen,
} from "@/features/onboarding/setup-seen";
import { screenGutter, spacing } from "@/theme";

/** Placeholder Home until the real one (and its tab bar) is built. */
export default function Home() {
  const setupSeen = useSetupSeen();
  const queryClient = useQueryClient();

  if (setupSeen.isPending) {
    return <ActivityIndicator style={styles.center} />;
  }
  if (setupSeen.data === false) {
    return <Redirect href="/onboarding" />;
  }
  return (
    <SafeAreaView style={styles.page}>
      <Text variant="h1">Home</Text>
      <Text color="secondary">The real Home screen comes next.</Text>
      {/* Until the tab bar exists. */}
      <Button title="Your family" onPress={() => router.push("/family")} />
      {__DEV__ && (
        // Setup is first-run only; this replays it while developing.
        <Button
          title="Replay setup (dev)"
          variant="secondary"
          onPress={() =>
            void clearSetupSeen().then(() =>
              queryClient.setQueryData(setupSeenQueryKey, false)
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  page: { flex: 1, padding: screenGutter, gap: spacing.sm },
});
