import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Text } from "@/components";
import { useHousehold } from "@/features/household/api";
import { HouseholdLoading } from "@/features/household/household-loading";
import { useLabelCheck } from "@/features/label/api";
import { UnreadLabel } from "@/features/verdict/unread-label";
import { Verdict } from "@/features/verdict/verdict-screen";
import { screenGutter, spacing } from "@/theme";

/** A pack with no barcode, checked from its label for the family (design 2d). */
export default function LabelCheck() {
  const { id, for: scannedFor } = useLocalSearchParams<{
    id: string;
    for?: string;
  }>();
  const check = useLabelCheck(id);
  const household = useHousehold();

  if (household.data === undefined) {
    return <HouseholdLoading household={household} />;
  }
  if (check.data === undefined) {
    return check.isError ? (
      <View style={styles.center}>
        <Text>Can’t load this label check right now.</Text>
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => void check.refetch()}
        />
      </View>
    ) : (
      <ActivityIndicator style={styles.fill} />
    );
  }
  if (!check.data.product.has_ingredients) {
    return (
      <UnreadLabel barcode={null} result={check.data} scannedFor={scannedFor} />
    );
  }
  return (
    <Verdict
      result={check.data}
      members={household.data.members}
      scannedFor={scannedFor}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: screenGutter,
  },
});
