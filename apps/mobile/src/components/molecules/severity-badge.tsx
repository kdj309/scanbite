import type { Severity } from "@foodscanner/shared";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { Icon, type IconName } from "@/components/atoms/icon";
import { Text } from "@/components/atoms/text";
import { colors, fonts, radii, severityColors, spacing } from "@/theme";

/** "none": this person has no conditions or allergies yet, so nothing was checked for them. */
export type BadgeSeverity = Severity | "none";

export const SEVERITY_WORDS: Record<BadgeSeverity, string> = {
  green: "Safe",
  yellow: "Caution",
  red: "Avoid",
  none: "Analyze for you",
};

const ICONS: Record<BadgeSeverity, IconName> = {
  green: "check",
  yellow: "alert",
  red: "block",
  none: "arrowRight",
};

type Look = { fill: string; content: string; border?: string; glow?: string };

function lookFor(severity: BadgeSeverity): Look {
  if (severity === "none") {
    // Never filled: an outline can't be mistaken for a verdict.
    return {
      fill: colors.surface,
      content: colors.brandText,
      border: colors.brandText,
    };
  }
  const tone = severityColors[severity];
  return { fill: tone.solid, content: tone.onSolid, glow: tone.glow };
}

export type SeverityBadgeProps = Omit<ViewProps, "style" | "children"> & {
  severity: BadgeSeverity;
  /** e.g. "Avoid for Papa"; defaults to the plain word ("Avoid"). */
  label?: string;
  /** sm: product cards. md: lists and rows. lg: the verdict hero. */
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
};

/**
 * The verdict. Colour, icon and word always go together, so it reads
 * without colour too; screen readers hear only the words.
 */
export function SeverityBadge({
  severity,
  label,
  size = "md",
  style,
  ...rest
}: SeverityBadgeProps) {
  const look = lookFor(severity);
  const words = label ?? SEVERITY_WORDS[severity];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={words}
      {...rest}
      style={[
        styles.badge,
        sizeStyles[size],
        { backgroundColor: look.fill },
        look.border !== undefined && {
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: look.border,
        },
        size === "lg" &&
          look.glow !== undefined && { boxShadow: `0 6px 16px ${look.glow}` },
        style,
      ]}
    >
      <Icon
        name={ICONS[severity]}
        size={ICON_SIZE[size]}
        color={look.content}
      />
      <Text
        variant={size === "lg" ? "button" : "label"}
        style={[size === "sm" && styles.smallText, { color: look.content }]}
      >
        {words}
      </Text>
    </View>
  );
}

const ICON_SIZE = { sm: 14, md: 16, lg: 18 } as const;

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
  },
  smallText: { fontFamily: fonts.extrabold },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingVertical: 4, paddingHorizontal: 9, gap: spacing.xxs },
  md: { paddingVertical: 7, paddingHorizontal: 13, gap: 6 },
  lg: { paddingVertical: 9, paddingHorizontal: spacing.md, gap: spacing.xs },
});
