import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bitey,
  BrandScreen,
  Button,
  Icon,
  type IconName,
  Text,
} from "@/components";
import { useRuleExplainer } from "@/features/verdict/api";
import { WhySheet } from "@/features/verdict/why-sheet";
import { closeScreen } from "@/navigation/close-screen";
import { colors, radii, screenGutter, spacing } from "@/theme";

const POINTS: { icon: IconName; title: string; line: string }[] = [
  {
    icon: "label",
    title: "Where the data comes from",
    line: "The pack label, Open Food Facts, or your label photos read by AI.",
  },
  {
    icon: "scales",
    title: "The rules we use",
    line: "FSSAI food limits, ICMR guidance, the UK front-of-pack model and NOVA processing groups.",
  },
  {
    icon: "family",
    title: "Your family makes it stricter",
    line: "Conditions can only add a warning. They never hide one.",
  },
  {
    icon: "never",
    title: "What we never do",
    line: "Take money from brands, or replace your doctor.",
  },
];

/** The rule behind "See an example": the high-sugar explainer. */
const EXAMPLE_RULE = "sugar_uk_fop";

/** How ScanBite decides (design S12), opened from the (i) on a verdict. */
export default function HowWeDecide() {
  const insets = useSafeAreaInsets();
  const [exampleOpen, setExampleOpen] = useState(false);
  const example = useRuleExplainer(EXAMPLE_RULE, undefined);

  return (
    <BrandScreen
      onBack={closeScreen}
      header={
        <View style={styles.titleRow}>
          <View style={styles.biteyDisc}>
            <Bitey size={46} />
          </View>
          <Text variant="h1" color="onBrand" accessibilityRole="header">
            How we decide
          </Text>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.list}>
        {POINTS.map((point) => (
          <View key={point.title} style={styles.card}>
            <View style={styles.iconTile}>
              <Icon name={point.icon} size={22} color={colors.brandText} />
            </View>
            <View style={styles.fill}>
              <Text variant="title">{point.title}</Text>
              <Text color="secondary" style={styles.line}>
                {point.line}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {/* Shown once its words have loaded, so the tap always opens it. */}
        {example.data && (
          <Button
            title="See an example: high sugar"
            variant="secondary"
            onPress={() => setExampleOpen(true)}
          />
        )}
      </View>
      <WhySheet
        explainer={exampleOpen ? (example.data ?? undefined) : undefined}
        forWhom={undefined}
        onClose={() => setExampleOpen(false)}
      />
    </BrandScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  biteyDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  list: { gap: spacing.sm, padding: screenGutter },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTint,
  },
  line: { marginTop: 2, fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: screenGutter, paddingTop: 10 },
});
