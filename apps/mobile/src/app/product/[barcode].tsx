import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Text } from "@/components";
import { useHousehold } from "@/features/household/api";
import { HouseholdLoading } from "@/features/household/household-loading";
import { ComingNext } from "@/features/placeholder/coming-next";
import { useProduct } from "@/features/verdict/api";
import { UnreadLabel } from "@/features/verdict/unread-label";
import { Verdict } from "@/features/verdict/verdict-screen";
import { screenGutter, spacing } from "@/theme";

/** One product's verdict, for each person (design S2 Avoid, S5 Safe). */
export default function Product() {
  const { barcode, for: scannedFor } = useLocalSearchParams<{
    barcode: string;
    for?: string;
  }>();
  const product = useProduct(barcode);
  const household = useHousehold();

  if (household.data === undefined) {
    return <HouseholdLoading household={household} />;
  }
  if (product.data === undefined) {
    return product.isError ? (
      <View style={styles.center}>
        <Text>Can’t load this product right now.</Text>
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => void product.refetch()}
        />
      </View>
    ) : (
      <ActivityIndicator style={styles.fill} />
    );
  }
  if (!product.data.found) {
    return <ComingNext title="We don’t know this product yet" />;
  }
  if (!product.data.product.has_ingredients) {
    return (
      <UnreadLabel
        barcode={barcode}
        result={product.data}
        scannedFor={scannedFor}
      />
    );
  }
  return (
    <Verdict
      result={product.data}
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
