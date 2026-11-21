import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radii, spacing } from "@/theme";

export type CardProps = ViewProps;

/** A white surface with a hairline border on the cream background. */
export function Card({ style, ...rest }: CardProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
});
