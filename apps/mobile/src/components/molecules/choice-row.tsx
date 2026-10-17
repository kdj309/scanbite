import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/atoms/text";
import { colors, fonts, radii } from "@/theme";

export type ChoiceRowProps<T extends string> = {
  /** Names the group for screen readers ("Age"). */
  label: string;
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pick one of a few short options laid out in a row (age bands). Announced
 * as a radio group: "60+, selected, 5 of 5".
 */
export function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
  style,
}: ChoiceRowProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.row, style]}
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={option}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option)}
            style={[styles.option, selected && styles.selected]}
          >
            {/* Five bands share one phone-width row: shrink to fit rather than overflow. */}
            <Text
              style={[styles.text, selected && styles.selectedText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
  },
  option: {
    flex: 1,
    minHeight: 60,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: {
    flex: 1.4,
    minHeight: 76,
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  // Unselected options are dimmed on purpose (design); they're still the
  // secondary text colour so they pass contrast.
  text: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.inkSecondary,
  },
  selectedText: { fontSize: 30, lineHeight: 36, color: colors.brandText },
});
