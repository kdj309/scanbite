import type { Severity } from "@foodscanner/shared";

/** From the design canvas (Colors board, accessibility pass 2026-10-07). */
export const colors = {
  /** Primary actions, the scan button, selected states. White text. */
  brand: "#3A6EC4",
  /** Brand as text and links on light grounds; also pressed primary and its raised edge. */
  brandText: "#2D5BA8",
  /** A pressed link. */
  brandTextPressed: "#1F4688",
  /** Chips, selected rows, soft panels, secondary buttons. */
  brandTint: "#EAF0FA",
  brandTintPressed: "#DCE6F7",

  /** Highlight only (scan glow, "new" tags), ink text, never near a verdict. */
  mango: "#FFD23F",
  mangoTint: "#FFF4CC",

  background: "#FFF9F1",
  surface: "#FFFFFF",
  ink: "#1A1523",
  inkSecondary: "#5E5668",
  /** Not-yet-chosen options (onboarding steps, unpicked age). */
  inkMuted: "#8C8396",
  hairline: "#EAE3EE",
  switchOff: "#D9D2DE",
  scrim: "rgba(26,21,35,0.45)",
  onBrand: "#FFFFFF",
} as const;

type SeverityColors = {
  /** Badge fill. */
  solid: string;
  /** Text and icons on `solid`. */
  onSolid: string;
  /** Full verdict surfaces. */
  tint: string;
  /** Text on `tint` (solid-on-tint text fails contrast). */
  onTint: string;
  /** Thin strokes such as avatar rings; caution's solid is too faint for one. */
  outline: string;
  /** Coloured shadow under the large verdict badge. */
  glow: string;
};

/** Keyed by the API's severity: green = Safe, yellow = Caution, red = Avoid. */
export const severityColors: Record<Severity, SeverityColors> = {
  green: {
    solid: "#127A4E",
    onSolid: "#FFFFFF",
    tint: "#D6F5E3",
    onTint: "#066638",
    outline: "#127A4E",
    glow: "rgba(10,125,69,0.3)",
  },
  yellow: {
    solid: "#FFA51F",
    onSolid: colors.ink,
    tint: "#FFEDC2",
    onTint: "#7A3A05",
    outline: "#B45309",
    glow: "rgba(255,165,31,0.4)",
  },
  red: {
    solid: "#9B1111",
    onSolid: "#FFFFFF",
    tint: "#FFE0DB",
    onTint: "#8E1010",
    outline: "#9B1111",
    glow: "rgba(155,17,17,0.3)",
  },
};
