import type {
  AlternativesResponse,
  HouseholdMember,
} from "@foodscanner/shared";
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
  BrandScreen,
  Button,
  Icon,
  SeverityBadge,
  Text,
} from "@/components";
import { useHousehold } from "@/features/household/api";
import { joinNames, sentenceName } from "@/features/scans/recent";
import { closeScreen } from "@/navigation/close-screen";
import { colors, radii, screenGutter, severityColors, spacing } from "@/theme";
import { useBetterOptions, useProduct } from "./api";
import type {
  BetterOptionsListProps,
  BetterOptionsScreenProps,
  CautionCardProps,
  ImprovementChipsProps,
  InsteadOfProps,
  OptionCardProps,
  ThumbProps,
} from "./better-options.types";
import { STORE_NAMES } from "./verdict-screen";

/**
 * Healthier swaps for a flagged product (design S4): Safe ones with where
 * to buy, then "Better, not perfect" (design 4a).
 */
export function BetterOptionsScreen({ barcode }: BetterOptionsScreenProps) {
  const options = useBetterOptions(barcode);
  const product = useProduct(barcode);
  const household = useHousehold();
  const severity =
    product.data?.found === true ? product.data.overall.severity : undefined;

  return (
    <BrandScreen
      onBack={closeScreen}
      header={
        <Text variant="h1" color="onBrand" accessibilityRole="header">
          {title(options.data, household.data?.members ?? [])}
        </Text>
      }
    >
      {options.data !== undefined && (
        <BetterOptionsList options={options.data} severity={severity} />
      )}
      {options.data === undefined && options.isError && (
        <View style={styles.center}>
          <Text>Can’t load better options right now.</Text>
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => void options.refetch()}
          />
        </View>
      )}
      {options.data === undefined && !options.isError && (
        <ActivityIndicator style={styles.center} />
      )}
    </BrandScreen>
  );
}

function BetterOptionsList({ options, severity }: BetterOptionsListProps) {
  const insets = useSafeAreaInsets();
  const safe = options.alternatives;
  const caution = options.better_not_perfect;
  const affiliate = safe.some((a) =>
    a.product.buy_links.some((link) => link.affiliate)
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.list,
        { paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <InsteadOf product={options.instead_of} severity={severity} />
      {safe.length === 0 && caution.length === 0 && <NothingBetterYet />}
      {safe.length === 0 && caution.length > 0 && (
        <Text color="secondary">No fully safe swap on this shelf yet.</Text>
      )}
      {safe.map((alternative, i) => (
        <OptionCard
          key={alternative.product.product_version_id}
          alternative={alternative}
          top={i === 0}
        />
      ))}
      {caution.length > 0 && (
        <View style={styles.section}>
          <Text variant="caption" style={styles.sectionTitle}>
            Better, not perfect
          </Text>
          {caution.map((alternative) => (
            <CautionCard
              key={alternative.product.product_version_id}
              alternative={alternative}
            />
          ))}
        </View>
      )}
      {[...safe, ...caution].some((a) => a.product.buy_links.length > 0) && (
        <Text variant="caption" style={styles.centered}>
          {affiliate
            ? "Check the pack before buying · Links may earn us a commission"
            : "Check the pack before buying"}
        </Text>
      )}
    </ScrollView>
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
  if (names.length === 0) return "Better options";
  return `Better for ${joinNames(names, "&")}`;
}

/** The scanned product these replace, with its verdict. */
function InsteadOf({ product, severity }: InsteadOfProps) {
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

/** A Safe swap, with where to buy it; the first is the top pick. */
function OptionCard({ alternative, top }: OptionCardProps) {
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
            <ImprovementChips improvements={improvements} />
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

/**
 * Better on what flagged it, still Caution: its badge and the worst thing
 * it's still flagged for. Where to buy, but quieter than a Safe swap's
 * (light buttons only); the API gives these plain, never affiliate, links.
 */
function CautionCard({ alternative }: CautionCardProps) {
  const { product, improvements, still_flagged } = alternative;
  const worst = still_flagged[0];
  const caution = severityColors.yellow;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Thumb product={product} size={56} tint={caution.tint} />
        <View style={styles.cardText}>
          <View style={styles.titleRow}>
            <Text variant="title" numberOfLines={2} style={styles.fill}>
              {product.name}
            </Text>
            <View
              style={[styles.miniBadge, { backgroundColor: caution.solid }]}
            >
              <Icon name="exclaim" size={11} color={caution.onSolid} />
              <Text variant="label" style={{ color: caution.onSolid }}>
                Caution
              </Text>
            </View>
          </View>
          <View style={styles.chips}>
            <ImprovementChips improvements={improvements} />
            {worst !== undefined && (
              <View style={[styles.chip, { backgroundColor: caution.tint }]}>
                <Icon name="exclaim" size={12} color={caution.onTint} />
                <Text variant="label" style={{ color: caution.onTint }}>
                  {worst}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      {product.buy_links.length > 0 && (
        <View style={styles.buyRow}>
          {product.buy_links.map((link) => (
            <Button
              key={link.store}
              title={STORE_NAMES[link.store]}
              variant="secondary"
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

/** Green chips for each way it beats the scanned product (the card wraps them). */
function ImprovementChips({ improvements }: ImprovementChipsProps) {
  return improvements.map((improvement) => (
    <View key={improvement.label} style={styles.chip}>
      <Icon name="check" size={12} color={severityColors.green.onTint} />
      <Text variant="label" style={styles.chipText}>
        {improvement.label}
      </Text>
    </View>
  ));
}

function Thumb({ product, size, tint = colors.surface }: ThumbProps) {
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
  section: { gap: spacing.sm },
  sectionTitle: { textTransform: "uppercase", letterSpacing: 0.8 },
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
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
  miniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
  },
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
