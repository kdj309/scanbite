import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { colors, minTouchTarget, radii, spacing } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";

const REMOVE_ICON_SIZE = 14;

export type ChipProps = Omit<ViewProps, "style" | "children"> & {
  label: string;
  /** Adds a remove (×) control, e.g. on a member's condition. */
  onRemove?: () => void;
  /** What the remove control removes, for screen readers; defaults to the label. */
  removeLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Small tinted label: conditions, "For Papa · Sugar". */
export function Chip({
  label,
  onRemove,
  removeLabel,
  style,
  ...rest
}: ChipProps) {
  return (
    <View {...rest} style={[styles.chip, onRemove && styles.removable, style]}>
      <Text variant="label" color="brand">
        {label}
      </Text>
      {onRemove && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${removeLabel ?? label}`}
          onPress={onRemove}
          // The × is small; the touch area still reaches 44×44.
          hitSlop={(minTouchTarget - REMOVE_ICON_SIZE) / 2}
          style={({ pressed }) => pressed && styles.removePressed}
        >
          <Icon name="close" size={REMOVE_ICON_SIZE} color={colors.brandText} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.brandTint,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  removable: { paddingRight: 10 },
  removePressed: { opacity: 0.6 },
});
