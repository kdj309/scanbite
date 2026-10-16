import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { buttonHeight, colors, radii, shadows, spacing } from "@/theme";
import { Icon, type IconName } from "./icon";
import { Text, type TextColor } from "./text";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

type VariantStyle = {
  base: ViewStyle;
  pressed: ViewStyle;
  text: TextColor;
  iconColor: string;
};

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  /** The one main action on a screen. */
  primary: {
    base: { backgroundColor: colors.brand, boxShadow: shadows.primaryEdge },
    pressed: {
      backgroundColor: colors.brandText,
      boxShadow: shadows.primaryEdgePressed,
      transform: [{ translateY: 3 }],
    },
    text: "onBrand",
    iconColor: colors.onBrand,
  },
  secondary: {
    base: { backgroundColor: colors.brandTint },
    pressed: { backgroundColor: colors.brandTintPressed },
    text: "brand",
    iconColor: colors.brandText,
  },
  outline: {
    base: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.hairline,
    },
    pressed: { backgroundColor: colors.brandTint },
    text: "ink",
    iconColor: colors.ink,
  },
  /** Low-emphasis choices such as "Skip for now". */
  ghost: {
    base: { backgroundColor: "transparent" },
    pressed: { backgroundColor: colors.brandTint },
    text: "secondary",
    iconColor: colors.inkSecondary,
  },
};

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  variant?: ButtonVariant;
  /** Shown before the title. */
  icon?: IconName;
  /** Shows a spinner and blocks presses; the title stays for screen readers. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = "primary",
  icon,
  loading = false,
  disabled,
  accessibilityState,
  style,
  ...rest
}: ButtonProps) {
  const look = VARIANTS[variant];
  const inactive = disabled === true || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={inactive}
      {...rest}
      // Merged, so a caller's state (e.g. selected) keeps ours.
      accessibilityState={{
        ...accessibilityState,
        disabled: inactive,
        busy: loading,
      }}
      style={({ pressed }) => [
        styles.button,
        look.base,
        pressed && look.pressed,
        disabled === true && styles.disabled,
        style,
      ]}
    >
      {/* Stays laid out while loading, so the button keeps its size. */}
      <View style={[styles.content, loading && styles.hidden]}>
        {icon && <Icon name={icon} color={look.iconColor} />}
        <Text variant="button" color={look.text}>
          {title}
        </Text>
      </View>
      {loading && (
        <ActivityIndicator color={look.iconColor} style={styles.spinner} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // minHeight, not height: grows with the phone's font size.
    minHeight: buttonHeight,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  disabled: { opacity: 0.5 },
  hidden: { opacity: 0 },
  spinner: { position: "absolute" },
});
