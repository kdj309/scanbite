import { Redirect, router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text } from "@/components";
import { useHousehold } from "@/features/household/api";
import { displayName } from "@/features/household/members";
import {
  clearSetupSeen,
  setupSeenQueryKey,
  useSetupSeen,
} from "@/features/onboarding/setup-seen";
import { useQueryClient } from "@tanstack/react-query";
import { screenGutter, spacing } from "@/theme";

/** Placeholder Home until the real one is built. */
export default function Home() {
  const setupSeen = useSetupSeen();
  const queryClient = useQueryClient();
  const household = useHousehold();

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
      <View style={styles.list}>
        {household.data?.members.map((member) => (
          <View key={member.id} style={styles.member}>
            <Text style={styles.memberText}>
              {displayName(member)} · {member.conditions.length} conditions ·{" "}
              {member.allergies.length} allergies
            </Text>
            {/* Until the Family screen exists. */}
            <Button
              variant="link"
              title="Edit"
              accessibilityLabel={`Edit ${displayName(member)}`}
              onPress={() =>
                router.push({
                  pathname: "/family/[id]",
                  params: { id: member.id },
                })
              }
            />
          </View>
        ))}
      </View>
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
  list: { gap: spacing.xxs, marginVertical: spacing.sm },
  member: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  memberText: { flex: 1 },
});
