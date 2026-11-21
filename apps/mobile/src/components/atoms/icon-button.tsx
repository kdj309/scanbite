import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { buttonHeight, colors, minTouchTarget, radii } from "@/theme";
import { Icon, type IconName } from "./icon";

export type IconButtonProps = Omit<PressableProps, "style" | "children"> & {
  icon: IconName;
  /** plain: 44×44 in top bars. outline: 54×54 next to a full button (step footers). */
  variant?: "plain" | "outline";
  /** Required: an icon alone says nothing to a screen reader ("Close", "Back"). */
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Back, close and other icon-only actions; at least a 44×44 target. */
export function IconButton({
  icon,
  label,
  variant = "plain",
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
        variant === "outline" && styles.outline,
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
  outline: {
    width: buttonHeight,
    height: buttonHeight,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.hairline },
  disabled: { opacity: 0.5 },
});
