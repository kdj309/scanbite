import type { TextStyle } from "react-native";

/**
 * Each Manrope weight is its own font family (loaded in the root layout), so
 * text picks a weight by family, the same on iOS and Android.
 */
export const fonts = {
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
} as const;

/**
 * The scale the screens use (they refined the Typography board's H1 28 and
 * H2 20 down to 24 and 17). Nothing in the app is smaller than caption.
 */
export const textStyles = {
  /** Screen titles only. */
  display: {
    fontFamily: fonts.extrabold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  /** Product name on a result screen, sheet titles. */
  h1: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.36,
  },
  /** Section headers. */
  h2: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 24 },
  /** List row and card titles. */
  title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  /** All explainer and body text. */
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 },
  /** One flagged phrase inside body text. */
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  /** Sources, helper text, secondary lines. */
  caption: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  /** Badges, chips, small links ("Why?"). */
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  /** Button text. */
  button: { fontFamily: fonts.extrabold, fontSize: 16, lineHeight: 22 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textStyles;
