import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, fonts, radii, spacing } from "@/theme";
import { Text } from "./text";

export type TextFieldProps = Omit<TextInputProps, "style"> & {
  /** Shown above the input and read with it by screen readers. */
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function TextField({
  label,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      <Text variant="title" accessible={false} importantForAccessibility="no">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkSecondary}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, focused && styles.focused]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.brand },
});
