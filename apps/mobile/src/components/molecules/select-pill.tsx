import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/atoms/text";
import { colors, fonts, minTouchTarget, radii, spacing } from "@/theme";

export type SelectPillProps = Omit<PressableProps, "style" | "children"> & {
  label: string;
  selected: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
};

/** A compact multi-select option; announced as a checkbox that's checked or not. */
export function SelectPill({
  label,
  selected,
  onToggle,
  accessibilityState,
  style,
  ...rest
}: SelectPillProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      onPress={onToggle}
      {...rest}
      accessibilityState={{ ...accessibilityState, checked: selected }}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
        style,
      ]}
    >
      <Text
        variant="label"
        color={selected ? "brand" : "ink"}
        style={styles.text}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  pressed: { borderColor: colors.brandBorderPressed },
  text: { fontFamily: fonts.bold, fontSize: 14 },
});
