import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon } from "@/components/atoms/icon";
import { Text } from "@/components/atoms/text";
import { colors, radii } from "@/theme";

export type SelectTileProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  subtitle?: string;
  selected: boolean;
  onToggle: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Narrow (three-across) tiles can't fit "Hypothyroidism"; Android would
 * split the word. Shrink it a little onto one line instead.
 */
const FIT_ONE_LINE = {
  numberOfLines: 1,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.75,
} as const;

/** A multi-select tile (conditions); announced as a checkbox, checked or not. */
export function SelectTile({
  title,
  subtitle,
  selected,
  onToggle,
  accessibilityState,
  style,
  ...rest
}: SelectTileProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onToggle}
      {...rest}
      accessibilityState={{ ...accessibilityState, checked: selected }}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
        style,
      ]}
    >
      {selected && (
        <View style={styles.tick}>
          <Icon name="check" size={10} color={colors.onBrand} />
        </View>
      )}
      {/* Part of the tile's label, not a heading of its own. */}
      <Text
        variant="h2"
        accessibilityRole="none"
        style={styles.center}
        {...FIT_ONE_LINE}
      >
        {title}
      </Text>
      {subtitle !== undefined && (
        <Text variant="caption" style={styles.center} {...FIT_ONE_LINE}>
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 84,
    gap: 2,
    alignItems: "center",
    justifyContent: "center",
    // Room for the corner tick above the title (narrow tiles have no
    // space beside it).
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 6,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  pressed: { borderColor: colors.brandBorderPressed },
  tick: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
});
