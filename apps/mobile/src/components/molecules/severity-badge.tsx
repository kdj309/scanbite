import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { Icon } from "@/components/atoms/icon";
import { Text } from "@/components/atoms/text";
import {
  SEVERITY_WORDS,
  VERDICT_MARKS,
  type VerdictTone,
} from "@/components/verdict-tone";
import { colors, radii, severityColors } from "@/theme";

const WORDS: Record<VerdictTone, string> = {
  ...SEVERITY_WORDS,
  none: "Analyze for you",
};

export type SeverityBadgeProps = Omit<ViewProps, "style" | "children"> & {
  severity: VerdictTone;
  /** e.g. "Avoid for Papa"; defaults to the plain word ("Avoid"). */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The verdict. Colour, icon and words always go together, so it reads
 * without colour too; screen readers hear only the words.
 */
export function SeverityBadge({
  severity,
  label,
  style,
  ...rest
}: SeverityBadgeProps) {
  const words = label ?? WORDS[severity];
  const tone = severity === "none" ? undefined : severityColors[severity];
  const content = tone?.onSolid ?? colors.brandText;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={words}
      {...rest}
      style={[
        styles.badge,
        tone
          ? {
              backgroundColor: tone.solid,
              // A soft glow in the verdict's own colour (design).
              boxShadow: `0 3px 8px ${tone.solid}33`,
            }
          : styles.none,
        style,
      ]}
    >
      <Icon name={VERDICT_MARKS[severity]} size={17} color={content} />
      <Text variant="button" style={[styles.words, { color: content }]}>
        {words}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    // Never wider than the screen: long words wrap inside the pill.
    maxWidth: "100%",
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
  },
  // Below the product name in weight (design S2).
  words: { fontSize: 15, lineHeight: 20, flexShrink: 1 },
  // Never filled: an outline can't be mistaken for a verdict.
  none: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.brandText,
  },
});
