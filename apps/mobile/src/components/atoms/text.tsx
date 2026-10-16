import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { colors, textStyles, type TextVariant } from "@/theme";

export type TextColor = "ink" | "secondary" | "brand" | "onBrand";

const COLOR_VALUES: Record<TextColor, string> = {
  ink: colors.ink,
  secondary: colors.inkSecondary,
  brand: colors.brandText,
  onBrand: colors.onBrand,
};

/** Captions are secondary text in the design; everything else is ink. */
const DEFAULT_COLOR: Partial<Record<TextVariant, TextColor>> = {
  caption: "secondary",
};

/** Screen readers announce these as headings, for jumping between sections. */
const HEADING_VARIANTS = new Set<TextVariant>(["display", "h1", "h2"]);

/**
 * Text grows with the phone's font size setting. The big styles stop at
 * 1.5×: they're already large and would otherwise push content off screen.
 */
const MAX_FONT_SCALE: Partial<Record<TextVariant, number>> = {
  display: 1.5,
  h1: 1.5,
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: TextColor;
};

export function Text({ variant = "body", color, style, ...rest }: TextProps) {
  return (
    <RNText
      accessibilityRole={HEADING_VARIANTS.has(variant) ? "header" : undefined}
      maxFontSizeMultiplier={MAX_FONT_SCALE[variant]}
      {...rest}
      style={[
        textStyles[variant],
        { color: COLOR_VALUES[color ?? DEFAULT_COLOR[variant] ?? "ink"] },
        style,
      ]}
    />
  );
}
