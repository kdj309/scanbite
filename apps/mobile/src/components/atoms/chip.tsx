import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radii, spacing } from "@/theme";
import { Text } from "./text";

export type ChipProps = Omit<ViewProps, "children"> & { label: string };

/** Small tinted label, e.g. a condition ("Sugar"). */
export function Chip({ label, style, ...rest }: ChipProps) {
  return (
    <View {...rest} style={[styles.chip, style]}>
      <Text variant="label" color="brand">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandTint,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
});
