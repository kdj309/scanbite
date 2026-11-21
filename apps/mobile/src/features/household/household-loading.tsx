import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Text } from "@/components";
import { spacing } from "@/theme";
import type { HouseholdLoadingProps } from "./household.types";

/** Until the family first loads: a spinner, or a retry if it couldn't. */
export function HouseholdLoading({ household }: HouseholdLoadingProps) {
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { gap: spacing.sm, padding: spacing.lg },
});
