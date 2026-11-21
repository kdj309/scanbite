import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BrandScreen,
  Button,
  Icon,
  Text,
  toneColors,
  VERDICT_MARKS,
} from "@/components";
import { healthChecks } from "@/features/household/members";
import { closeScreen } from "@/navigation/close-screen";
import { colors, radii, screenGutter, severityColors, spacing } from "@/theme";
import { basis, decidedFor, nutritionRows, sourceLine, tiles } from "./decided";
import type {
  CheckMarkProps,
  ChecksCardProps,
  DecidedHeaderProps,
  DecidedScreenProps,
  DecidedUnavailableProps,
  ExpandRowProps,
  LabelDetailsProps,
  LabelSection,
  NutrientTilesProps,
} from "./decided.types";

/**
 * How we decided, for one product and one person (design 12a): what we
 * checked, the key numbers, and the full label behind them.
 */
export function DecidedScreen({
  result,
  members,
  memberId,
}: DecidedScreenProps) {
  const insets = useSafeAreaInsets();
  const { person, verdict, flagged } = decidedFor(result, members, memberId);

  return (
    <BrandScreen
      onBack={closeScreen}
      header={
        <DecidedHeader
          productName={result.product.name}
          person={person}
          source={result.product.source}
        />
      }
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {verdict && <ChecksCard verdict={verdict} />}
        <NutrientTiles
          tiles={tiles(result.nutrition, flagged)}
          basis={basis(result.nutrition)}
        />
        <LabelDetails
          rows={nutritionRows(result.nutrition, flagged)}
          ingredients={result.ingredients}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/how-we-decide")}
          style={styles.link}
        >
          <Text variant="label" color="brand">
            How ScanBite decides
          </Text>
          <Icon name="chevronRight" size={16} color={colors.brandText} />
        </Pressable>
      </ScrollView>
    </BrandScreen>
  );
}

/** When the product can't be shown: why, a retry if it may work, and back. */
export function DecidedUnavailable({
  message,
  onRetry,
}: DecidedUnavailableProps) {
  return (
    <BrandScreen onBack={closeScreen} header={<Title />}>
      <View style={styles.center}>
        <Text>{message}</Text>
        {onRetry && (
          <Button title="Try again" variant="secondary" onPress={onRetry} />
        )}
      </View>
    </BrandScreen>
  );
}

function Title() {
  return (
    <Text variant="h1" color="onBrand" accessibilityRole="header">
      How we decided
    </Text>
  );
}

/** Who it's for and where the facts came from. */
function DecidedHeader({ productName, person, source }: DecidedHeaderProps) {
  const isSelf = person?.relationship === "self";
  return (
    <>
      <Title />
      <Text variant="title" color="onBrand" numberOfLines={2}>
        {productName}
      </Text>
      {person && (
        <View style={styles.forChip}>
          <View style={styles.forInitial}>
            <Text variant="label" color="onBrand" maxFontSizeMultiplier={1}>
              {isSelf ? "Y" : person.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text variant="label" numberOfLines={1} style={styles.shrink}>
            {[
              isSelf ? "For you" : `For ${person.name}`,
              ...healthChecks(person),
            ].join(" · ")}
          </Text>
        </View>
      )}
      <View style={styles.source}>
        <Icon name="label" size={16} color={colors.onBrand} />
        <Text variant="label" color="onBrand">
          {sourceLine(source)}
        </Text>
      </View>
    </>
  );
}

/** Flags in their verdict colour, gaps, then what passed. */
function ChecksCard({ verdict }: ChecksCardProps) {
  return (
    <View>
      <Text variant="caption" style={styles.section}>
        What we checked
      </Text>
      <View style={styles.card}>
        {verdict.reasons.map((reason) => {
          const tone = reason.kind === "flag" ? reason.severity : undefined;
          return (
            <View key={reason.rule_id + reason.label} style={styles.check}>
              <CheckMark tone={tone} />
              <View style={styles.fill}>
                <Text
                  variant="title"
                  style={tone ? { color: toneColors(tone).onTint } : undefined}
                >
                  {reason.label}
                </Text>
                <Text variant="caption">{reason.text}</Text>
              </View>
            </View>
          );
        })}
        {verdict.checked.map((passed) => (
          <View key={passed.label} style={styles.check}>
            <CheckMark tone="green" />
            <Text variant="title" style={styles.fill}>
              {passed.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The four key numbers; a flagged one takes its flag's colour. */
function NutrientTiles({ tiles, basis }: NutrientTilesProps) {
  return (
    <View>
      <Text variant="caption" style={styles.section}>
        Per {basis}
      </Text>
      <View style={styles.tiles}>
        {tiles.map((tile) => {
          const tint = tile.tone ? severityColors[tile.tone] : undefined;
          return (
            <View
              key={tile.name}
              style={[styles.tile, tint && { backgroundColor: tint.tint }]}
              accessible
              accessibilityLabel={`${tile.name} ${tile.value}${tile.tone ? ", flagged" : ""}`}
            >
              <Text
                variant="label"
                style={{ color: tint?.onTint ?? colors.inkSecondary }}
              >
                {tile.name}
              </Text>
              <Text
                variant="title"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={tint && { color: tint.onTint }}
              >
                {tile.value}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** The full label: nutrition table and ingredients, one open at a time. */
function LabelDetails({ rows, ingredients }: LabelDetailsProps) {
  const [open, setOpen] = useState<LabelSection>();
  const toggle = (section: LabelSection) =>
    setOpen((current) => (current === section ? undefined : section));

  return (
    <View style={styles.card}>
      <ExpandRow
        title="All nutrition"
        open={open === "nutrition"}
        onPress={() => toggle("nutrition")}
      />
      {open === "nutrition" &&
        rows.map((row) => {
          const tint = row.tone ? severityColors[row.tone] : undefined;
          return (
            <View
              key={row.name}
              style={[
                styles.nutrient,
                row.sub && styles.nutrientSub,
                tint && { backgroundColor: tint.tint },
              ]}
            >
              <Text
                variant={row.sub ? "caption" : "body"}
                style={tint && { color: tint.onTint }}
              >
                {row.name}
              </Text>
              <Text variant="title" style={tint && { color: tint.onTint }}>
                {row.value}
              </Text>
            </View>
          );
        })}
      <View style={styles.divider} />
      <ExpandRow
        title={`Ingredients (${ingredients.length})`}
        open={open === "ingredients"}
        onPress={() => toggle("ingredients")}
      />
      {open === "ingredients" && (
        <View style={styles.ingredients}>
          {ingredients.map((ingredient, i) => (
            // Labels can repeat an ingredient; the list never reorders.
            <View key={`${i}-${ingredient}`} style={styles.ingredient}>
              <Text variant="label">{ingredient}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** ✕ / ! for a flag in its verdict colour, ✓ for a pass, ? for a gap. */
function CheckMark({ tone }: CheckMarkProps) {
  const { fill, ink } = markColors(tone);
  return (
    <View style={[styles.mark, { backgroundColor: fill }]}>
      <Icon
        name={tone ? VERDICT_MARKS[tone] : "question"}
        size={12}
        color={ink}
      />
    </View>
  );
}

/** A pass sits on the soft tint, a flag on its solid colour, a gap on grey. */
function markColors(tone: CheckMarkProps["tone"]) {
  if (tone === undefined) {
    return { fill: colors.noResultTint, ink: colors.inkSecondary };
  }
  const palette = severityColors[tone];
  if (tone === "green") {
    return { fill: palette.tint, ink: palette.onTint };
  }
  return { fill: palette.solid, ink: palette.onSolid };
}

function ExpandRow({ title, open, onPress }: ExpandRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={styles.row}
    >
      <Text variant="title">{title}</Text>
      <View style={open && styles.chevronOpen}>
        <Icon name="chevronDown" size={18} color={colors.inkSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  forChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    maxWidth: "100%",
    paddingVertical: spacing.xxs,
    paddingLeft: spacing.xxs,
    paddingRight: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  forInitial: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  source: { flexDirection: "row", alignItems: "center", gap: 6 },
  content: { gap: 14, padding: screenGutter, paddingTop: 18 },
  section: {
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  check: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  tiles: { flexDirection: "row", gap: spacing.xs },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  divider: { height: 1, backgroundColor: colors.hairline },
  nutrient: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  nutrientSub: { paddingLeft: 28 },
  ingredients: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  ingredient: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.noResultTint,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 44,
  },
});
