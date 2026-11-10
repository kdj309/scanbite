import type {
  Alternative,
  AlternativesResponse,
  HouseholdMember,
  ProductSummary,
} from "@foodscanner/shared";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bitey,
  Button,
  DotPattern,
  Icon,
  IconButton,
  SeverityBadge,
  Text,
} from "@/components";
import { useHousehold } from "@/features/household/api";
import { joinNames, sentenceName } from "@/features/scans/recent";
import { useBetterOptions, useProduct } from "@/features/verdict/api";
import { STORE_NAMES } from "@/features/verdict/verdict-screen";
import { closeScreen } from "@/navigation/close-screen";
import { colors, radii, screenGutter, severityColors, spacing } from "@/theme";

/** Healthier swaps for a flagged product, with where to buy (design S4). */
export default function BetterOptions() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const options = useBetterOptions(barcode);
  const product = useProduct(barcode);
  const household = useHousehold();
  const insets = useSafeAreaInsets();
  const severity =
    product.data?.found === true ? product.data.overall.severity : undefined;

  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <DotPattern />
        <View style={styles.bar}>
          <IconButton
            icon="chevronLeft"
            label="Back"
            color={colors.onBrand}
            onPress={closeScreen}
            style={styles.barButton}
          />
        </View>
        <Text variant="h1" color="onBrand" accessibilityRole="header">
          {title(options.data, household.data?.members ?? [])}
        </Text>
      </View>
      <View style={styles.sheet}>
        {options.data === undefined ? (
          options.isError ? (
            <View style={styles.center}>
              <Text>Can’t load better options right now.</Text>
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => void options.refetch()}
              />
            </View>
          ) : (
            <ActivityIndicator style={styles.center} />
          )
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            <InsteadOf product={options.data.instead_of} severity={severity} />
            {options.data.alternatives.length === 0 ? (
              <NothingBetterYet />
            ) : (
              <>
                {options.data.alternatives.map((alternative, i) => (
                  <OptionCard
                    key={alternative.product.product_version_id}
                    alternative={alternative}
                    top={i === 0}
                  />
                ))}
                <Text variant="caption" style={styles.centered}>
                  {options.data.alternatives.some((a) =>
                    a.product.buy_links.some((link) => link.affiliate)
                  )
                    ? "Check the pack before buying · Links may earn us a commission"
                    : "Check the pack before buying"}
                </Text>
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

/** "Better for Papa", "Better for Amma & Papa"; plain while loading. */
function title(
  options: AlternativesResponse | undefined,
  members: readonly HouseholdMember[]
): string {
  const names = (options?.for_member_ids ?? [])
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is HouseholdMember => member !== undefined)
    .map(sentenceName);
  return names.length > 0
    ? `Better for ${joinNames(names, "&")}`
    : "Better options";
}

/** The scanned product these replace, with its verdict. */
function InsteadOf({
  product,
  severity,
}: {
  product: ProductSummary;
  severity: "green" | "yellow" | "red" | undefined;
}) {
  return (
    <View
      style={[
        styles.insteadOf,
        severity && { backgroundColor: severityColors[severity].tint },
      ]}
    >
      <Thumb product={product} size={36} />
      <Text variant="title" numberOfLines={2} style={styles.fill}>
        Instead of {product.name}
      </Text>
      {severity && <SeverityBadge severity={severity} />}
    </View>
  );
}

function OptionCard({
  alternative,
  top,
}: {
  alternative: Alternative;
  top: boolean;
}) {
  const { product, improvements } = alternative;
  const details = [product.brand, product.quantity].filter(Boolean).join(" · ");
  return (
    <View style={[styles.card, top && styles.topCard]}>
      {top && (
        <View style={styles.ribbon}>
          <Icon name="star" size={12} color={colors.ink} />
          {/* Not shrunk: Android cut it to "Top" in this floating label. */}
          <Text variant="label" numberOfLines={1} style={styles.ribbonText}>
            Top pick
          </Text>
        </View>
      )}
      <View style={styles.cardHead}>
        <Thumb product={product} size={56} tint={severityColors.green.tint} />
        <View style={styles.cardText}>
          <Text variant="title" numberOfLines={2}>
            {product.name}
          </Text>
          {details !== "" && (
            <Text variant="caption" numberOfLines={1}>
              {details}
            </Text>
          )}
          <View style={styles.chips}>
            {improvements.map((improvement) => (
              <View key={improvement.label} style={styles.chip}>
                <Icon
                  name="check"
                  size={12}
                  color={severityColors.green.onTint}
                />
                <Text variant="label" style={styles.chipText}>
                  {improvement.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      {product.buy_links.length > 0 && (
        <View style={styles.buyRow}>
          {product.buy_links.map((link, i) => (
            <Button
              key={link.store}
              title={STORE_NAMES[link.store]}
              variant={i === 0 ? "primary" : "secondary"}
              size="medium"
              onPress={() => void Linking.openURL(link.url)}
              style={styles.fill}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function Thumb({
  product,
  size,
  tint = colors.surface,
}: {
  product: ProductSummary;
  size: number;
  tint?: string;
}) {
  return (
    <View
      style={[
        styles.thumb,
        { width: size, height: size, backgroundColor: tint },
      ]}
    >
      {product.image_url ? (
        <Image
          source={{ uri: product.image_url }}
          style={styles.image}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Icon name="package" size={size / 2} color={colors.inkSecondary} />
      )}
    </View>
  );
}

function NothingBetterYet() {
  return (
    <View style={styles.empty}>
      <Bitey size={80} />
      <Text variant="bodyStrong" style={styles.centered}>
        Nothing better in our list yet
      </Text>
      <Text color="secondary" style={styles.centered}>
        Swaps show up here as more products are added.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { textAlign: "center" },
  header: {
    gap: spacing.xs,
    paddingHorizontal: screenGutter,
    paddingBottom: 40,
    overflow: "hidden",
    backgroundColor: colors.brand,
  },
  bar: { flexDirection: "row", paddingVertical: spacing.xs },
  barButton: { backgroundColor: "rgba(255,255,255,0.16)" },
  sheet: {
    flex: 1,
    marginTop: -26,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  list: { gap: spacing.md, padding: screenGutter, paddingTop: spacing.md },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: screenGutter,
  },
  insteadOf: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  card: {
    gap: spacing.sm,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  topCard: {
    marginTop: spacing.xs,
    paddingTop: 22,
    borderWidth: 2.5,
    borderColor: colors.mango,
  },
  ribbon: {
    position: "absolute",
    top: -12,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.mango,
  },
  ribbonText: { flexShrink: 0 },
  cardHead: { flexDirection: "row", gap: spacing.sm },
  cardText: { flex: 1, minWidth: 0, gap: spacing.xxs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: severityColors.green.tint,
  },
  chipText: { color: severityColors.green.onTint },
  thumb: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  buyRow: { flexDirection: "row", gap: spacing.xs },
  empty: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxl,
  },
});
