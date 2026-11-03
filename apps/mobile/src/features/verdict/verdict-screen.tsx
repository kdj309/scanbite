import type {
  BuyLink,
  HouseholdMember,
  ProductFoundResponse,
} from "@foodscanner/shared";
import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Icon,
  IconButton,
  SeverityBadge,
  Text,
  toneColors,
} from "@/components";
import { openEdit } from "@/features/household/edit-link";
import { healthChecks } from "@/features/household/members";
import { useRuleExplainer } from "@/features/verdict/api";
import { MoreList } from "@/features/verdict/more-list";
import { PersonSwitcher } from "@/features/verdict/person-switcher";
import { DisclaimerTip } from "@/features/verdict/tip";
import {
  defaultSelection,
  personOptions,
  verdictView,
  type VerdictView,
} from "@/features/verdict/view";
import { WhySheet } from "@/features/verdict/why-sheet";
import { colors, fonts, radii, screenGutter, spacing } from "@/theme";
import { closeScreen } from "@/navigation/close-screen";

/** A product's (or label check's) verdict, for each person (design S2, S5, 2d). */
export function Verdict({
  result,
  members,
  scannedFor,
}: {
  result: ProductFoundResponse;
  members: readonly HouseholdMember[];
  scannedFor: string | undefined;
}) {
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<string>();
  const [whyOpen, setWhyOpen] = useState(false);
  const selected = chosen ?? defaultSelection(result, scannedFor);
  const view = verdictView(result, members, selected);
  const options = personOptions(result, members);
  const person = members.find((m) => m.id === selected);

  const explainer =
    useRuleExplainer(view.whyRuleId, person?.id).data ?? undefined;

  return (
    <View style={styles.fill}>
      <ScrollView>
        <Hero
          view={view}
          result={result}
          person={person}
          topInset={insets.top}
        />
        <View style={styles.sheet}>
          <DisclaimerTip />
          {options.length > 2 && (
            <PersonSwitcher
              options={options}
              selected={selected}
              onSelect={setChosen}
            />
          )}
          <ReasonCard
            view={view}
            hasWhy={explainer !== undefined}
            onWhy={() => setWhyOpen(true)}
          />
          <MoreList key={selected} more={view.more} />
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {result.product.source === "label_check" ? (
          // Not a catalog product: no better options or places to buy.
          <Button
            title="Scan another"
            onPress={() =>
              router.replace({
                pathname: "/scan",
                params: scannedFor ? { for: scannedFor } : {},
              })
            }
          />
        ) : (
          <Actions
            view={view}
            person={person}
            buyLinks={result.product.buy_links}
          />
        )}
      </View>
      <WhySheet
        explainer={whyOpen ? explainer : undefined}
        forWhom={
          person && person.relationship !== "self"
            ? `For ${person.name} · ${healthChecks(person).join(", ")}`
            : undefined
        }
        onClose={() => setWhyOpen(false)}
      />
    </View>
  );
}

/** Product first, then the verdict and who it was checked for (design S2). */
function Hero({
  view,
  result,
  person,
  topInset,
}: {
  view: VerdictView;
  result: ProductFoundResponse;
  person: HouseholdMember | undefined;
  topInset: number;
}) {
  const addFor = view.addConditionsFor;
  const { product } = result;
  const labelCheck = product.source === "label_check";
  const details = [product.brand, product.quantity].filter(Boolean).join(" · ");
  return (
    <View
      style={[
        styles.hero,
        {
          paddingTop: topInset,
          backgroundColor: toneColors(view.severity).tint,
        },
      ]}
    >
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
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.image}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Icon
              name={labelCheck ? "label" : "package"}
              size={30}
              color={colors.inkSecondary}
            />
          )}
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
          <View style={styles.details}>
            {product.veg !== "unknown" && <VegMark veg={product.veg} />}
            <Text variant="caption" numberOfLines={1} style={styles.fill}>
              {details}
            </Text>
          </View>
          {product.verifying && (
            <Text variant="label" style={styles.verifying}>
              Read by AI from the label
            </Text>
          )}
          {labelCheck && (
            <View style={styles.fromLabel}>
              <Icon name="label" size={13} color={colors.brandText} />
              <Text variant="label" color="brand">
                Checked from your label
              </Text>
            </View>
          )}
        </View>
      </View>
      {/* Two fixed lines, so the (i) never moves. */}
      <View style={styles.verdict}>
        {addFor ? (
          // Nothing personal checked: the badge itself is the way to fix it.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${view.badge}. Add their conditions`}
            onPress={() => openEdit(addFor)}
          >
            <SeverityBadge
              severity={view.severity}
              label={view.badge}
              accessible={false}
            />
          </Pressable>
        ) : (
          <SeverityBadge severity={view.severity} label={view.badge} />
        )}
        <View style={styles.checkedRow}>
          <View style={styles.who}>
            <View style={styles.whoInitial}>
              {person ? (
                <Text variant="label" color="onBrand" maxFontSizeMultiplier={1}>
                  {person.relationship === "self"
                    ? "Y"
                    : person.name.charAt(0).toUpperCase()}
                </Text>
              ) : (
                <Icon name="family" size={14} color={colors.onBrand} />
              )}
            </View>
            <Text variant="label" numberOfLines={1} style={styles.shrink}>
              {view.checkedFor}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How we decide"
            onPress={() => router.push("/how-we-decide")}
            hitSlop={7}
            style={styles.info}
          >
            <Text variant="label" color="brand">
              i
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** The main reason, below "See it for"; its only action is a link. */
function ReasonCard({
  view,
  hasWhy,
  onWhy,
}: {
  view: VerdictView;
  hasWhy: boolean;
  onWhy: () => void;
}) {
  return (
    <View style={styles.reason}>
      <Text variant="caption" style={styles.reasonLabel}>
        {view.reasonLabel}
      </Text>
      <Text
        style={[
          styles.reasonTitle,
          { color: toneColors(view.severity).onTint },
        ]}
      >
        {view.title}
      </Text>
      <Text style={styles.reasonLine}>{view.line}</Text>
      {hasWhy && (
        <Button
          title="Why does this matter? →"
          variant="link"
          onPress={onWhy}
        />
      )}
    </View>
  );
}

/** The FSSAI veg (green dot) or non-veg (brown triangle) mark. */
function VegMark({ veg }: { veg: "veg" | "non_veg" }) {
  const color = veg === "veg" ? colors.veg : colors.nonVeg;
  return (
    <View
      accessible
      accessibilityLabel={veg === "veg" ? "Vegetarian" : "Non-vegetarian"}
      style={[styles.veg, { borderColor: color }]}
    >
      <View
        style={
          veg === "veg"
            ? [styles.vegDot, { backgroundColor: color }]
            : [styles.nonVeg, { borderBottomColor: color }]
        }
      />
    </View>
  );
}

const STORE_NAMES: Record<BuyLink["store"], string> = {
  amazon: "Amazon",
  bigbasket: "BigBasket",
};

/** Flagged: better options. Safe: where to buy, with the disclosure. */
function Actions({
  view,
  person,
  buyLinks,
}: {
  view: VerdictView;
  person: HouseholdMember | undefined;
  buyLinks: readonly BuyLink[];
}) {
  if (view.flagged) {
    return (
      <Button
        title={
          person && person.relationship !== "self"
            ? `See better options for ${person.name}`
            : "See better options"
        }
        onPress={() => router.push("/better-options")}
      />
    );
  }
  if (buyLinks.length === 0) {
    return null;
  }
  return (
    <>
      <View style={styles.buyRow}>
        {buyLinks.map((link, i) => (
          <Button
            key={link.store}
            title={
              i === 0
                ? `Buy on ${STORE_NAMES[link.store]}`
                : STORE_NAMES[link.store]
            }
            variant={i === 0 ? "primary" : "secondary"}
            onPress={() => void Linking.openURL(link.url)}
            style={styles.fill}
          />
        ))}
      </View>
      {buyLinks.some((link) => link.affiliate) && (
        <Text variant="caption" style={styles.centered}>
          We may earn a small commission. It never changes a rating.
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { textAlign: "center" },
  hero: { paddingHorizontal: screenGutter, paddingBottom: 34 },
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
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  image: { width: "100%", height: "100%" },
  details: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifying: {
    alignSelf: "flex-start",
    marginTop: spacing.xxs,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.mango,
    overflow: "hidden",
  },
  fromLabel: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: spacing.xxs,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  productName: { fontSize: 20, lineHeight: 26 },
  verdict: { alignItems: "flex-start", gap: spacing.xs },
  checkedRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: spacing.xs,
  },
  who: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xxs,
    paddingLeft: spacing.xxs,
    paddingRight: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.85)",
    // Never wider than the row, so the (i) after it stays on screen.
    flexShrink: 1,
  },
  shrink: { flexShrink: 1 },
  whoInitial: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  info: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  reason: {
    gap: spacing.xxs,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    boxShadow: "0 4px 14px rgba(26,21,35,0.06)",
  },
  reasonLabel: { textTransform: "uppercase", letterSpacing: 0.8 },
  reasonTitle: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 26 },
  reasonLine: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  veg: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  nonVeg: {
    width: 0,
    height: 0,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  sheet: {
    gap: spacing.sm,
    marginTop: -26,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: spacing.md,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
  },
  footer: {
    gap: spacing.xs,
    paddingHorizontal: screenGutter,
    paddingTop: 10,
    backgroundColor: colors.background,
  },
  buyRow: { flexDirection: "row", gap: spacing.xs },
});
