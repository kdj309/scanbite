import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, minTouchTarget, radii } from "@/theme";
import { Icon, type IconName } from "./icon";

export type IconButtonProps = Omit<PressableProps, "style" | "children"> & {
  icon: IconName;
  /** Required: an icon alone says nothing to a screen reader ("Close", "Back"). */
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Back, close and other icon-only actions; always a 44×44 target. */
export function IconButton({
  icon,
  label,
  color = colors.ink,
  disabled,
  accessibilityState,
  style,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      {...rest}
      // Merged, so a caller's state (e.g. selected) keeps ours.
      accessibilityState={{
        ...accessibilityState,
        disabled: disabled === true,
      }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled === true && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.hairline },
  disabled: { opacity: 0.5 },
});
