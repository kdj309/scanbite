import { Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Text } from "@/components";
import { useHousehold } from "@/features/household/api";
import { OnboardingDraftProvider } from "@/features/onboarding/draft";
import { colors, spacing } from "@/theme";

/** Loads the family first: setup shows who's already added. */
export default function OnboardingLayout() {
  const household = useHousehold();

  // Only before the first load: a failed refresh later (after a save)
  // mustn't tear down the flow the person is in the middle of.
  if (household.data === undefined) {
    if (!household.isError) {
      return <ActivityIndicator style={styles.center} />;
    }
    return (
      <View style={[styles.center, styles.error]}>
        <Text>Can’t load your family right now.</Text>
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => void household.refetch()}
        />
      </View>
    );
  }
  return (
    <OnboardingDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </OnboardingDraftProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { gap: spacing.sm, padding: spacing.lg },
});
