import type { Severity } from "@foodscanner/shared";
import { colors, severityColors } from "@/theme";
import type { IconName } from "./atoms/icon";

/** A verdict, or "none": nothing personal checked (no conditions or allergies yet). */
export type VerdictTone = Severity | "none";

export const SEVERITY_WORDS: Record<Severity, string> = {
  green: "Safe",
  yellow: "Caution",
  red: "Avoid",
};

/** The mark that goes with the colour, so a verdict reads without colour. */
export const VERDICT_MARKS: Record<VerdictTone, IconName> = {
  green: "check",
  yellow: "exclaim",
  red: "close",
  none: "plus",
};

/** Colours for a tone; "none" is brand blue, never a verdict colour. */
export function toneColors(tone: VerdictTone) {
  return tone === "none"
    ? {
        solid: colors.brandText,
        onSolid: colors.onBrand,
        tint: colors.brandTint,
        onTint: colors.brandText,
        outline: colors.brandText,
      }
    : severityColors[tone];
}
