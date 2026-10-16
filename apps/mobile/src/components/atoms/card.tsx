import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radii, shadows, spacing } from "@/theme";

export type CardVariant = "outlined" | "elevated";

export type CardProps = ViewProps & {
  /** outlined: hairline border (lists, household). elevated: soft shadow (main reason). */
  variant?: CardVariant;
};

/** A white surface on the cream background. */
export function Card({ variant = "outlined", style, ...rest }: CardProps) {
  return <View {...rest} style={[styles.card, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  outlined: { borderWidth: 1, borderColor: colors.hairline },
  elevated: { boxShadow: shadows.card },
});
