import type { ProductFoundResponse } from "@foodscanner/shared";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bitey, Button, Icon, IconButton, Text } from "@/components";
import { colors, fonts, radii, screenGutter, spacing } from "@/theme";
import { closeScreen } from "@/navigation/close-screen";

/**
 * A product whose label was read but whose ingredients weren't (design
 * 2c): no verdict at all, since an empty list would pass every check.
 * Scanning the label again replaces it whole once the ingredients read.
 */
export function UnreadLabel({
  barcode,
  result,
  scannedFor,
}: {
  barcode: string;
  result: ProductFoundResponse;
  scannedFor: string | undefined;
}) {
  const insets = useSafeAreaInsets();
  const { product } = result;
  const details = [product.brand, product.quantity].filter(Boolean).join(" · ");
  const forParam = scannedFor ? { for: scannedFor } : {};

  return (
    <View style={styles.fill}>
      <ScrollView>
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          <View style={styles.bar}>
            <IconButton
              icon="chevronLeft"
              label="Back"
              onPress={closeScreen}
              style={styles.barButton}
            />
          </View>
          <View style={styles.product}>
            <View style={styles.thumb}>
              <Icon name="package" size={30} color={colors.inkSecondary} />
            </View>
            <View style={styles.fill}>
              <Text
                variant="h2"
                accessibilityRole="header"
                numberOfLines={2}
                style={styles.productName}
              >
                {product.name}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {details}
              </Text>
            </View>
          </View>
          <View style={styles.badge}>
            <Icon name="question" size={18} color={colors.inkSecondary} />
            <Text style={styles.badgeText}>No result</Text>
          </View>
        </View>
        <View style={styles.sheet}>
          <View style={styles.card} accessible>
            <View style={styles.bitey}>
              <Bitey size={62} />
            </View>
            <Text style={styles.title}>Couldn’t read the label</Text>
            <Text color="secondary" style={styles.line}>
              The ingredients weren’t clear. Show me the whole label again?
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title="Scan the label again"
          icon="camera"
          onPress={() =>
            router.replace({
              pathname: "/scan",
              params: { label: barcode, ...forParam },
            })
          }
        />
        <Button
          title="Scan another"
          variant="link"
          onPress={() =>
            router.replace({ pathname: "/scan", params: forParam })
          }
          style={styles.centerSelf}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Neutral: no verdict, so no severity tint.
  hero: {
    paddingHorizontal: screenGutter,
    paddingBottom: 34,
    backgroundColor: colors.noResultTint,
  },
  bar: { flexDirection: "row", paddingVertical: spacing.xs },
  barButton: { backgroundColor: "rgba(255,255,255,0.55)" },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  productName: { fontSize: 20, lineHeight: 26 },
  // An outline in ink grey: never a severity colour or Analyze's blue dash.
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.noResultOutline,
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.inkSecondary,
  },
  sheet: {
    marginTop: -26,
    paddingHorizontal: spacing.md,
    paddingTop: 18,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
  },
  card: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    boxShadow: "0 4px 14px rgba(26,21,35,0.06)",
  },
  bitey: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mangoTint,
  },
  title: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 26 },
  line: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  footer: {
    gap: spacing.xs,
    paddingHorizontal: screenGutter,
    paddingTop: 10,
    backgroundColor: colors.background,
  },
  centerSelf: { alignSelf: "center" },
});
