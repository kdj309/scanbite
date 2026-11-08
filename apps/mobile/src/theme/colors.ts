import type { Relationship, Severity } from "@foodscanner/shared";

/** From the design canvas (Colors board, accessibility pass 2026-10-07). */
export const colors = {
  /** Primary actions, the scan button, selected states. White text. */
  brand: "#3A6EC4",
  /** Brand as text and links on light grounds; also pressed primary and its raised edge. */
  brandText: "#2D5BA8",
  /** Chips, selected rows, soft panels, secondary buttons. */
  brandTint: "#EAF0FA",
  brandTintPressed: "#DCE6F7",
  /** Border of a tile or pill being pressed, before it's selected. */
  brandBorderPressed: "#B9CBEA",

  /** Highlight only (scan glow, "new" tags), ink text, never near a verdict. */
  mango: "#FFD23F",
  mangoTint: "#FFF4CC",
  /** The star on "conditions tracked". */
  star: "#FFB800",

  background: "#FFF9F1",
  surface: "#FFFFFF",
  ink: "#1A1523",
  inkSecondary: "#5E5668",
  hairline: "#EAE3EE",
  onBrand: "#FFFFFF",

  /** "No result" (design 2c): a neutral hero and badge outline, never a verdict colour. */
  noResultTint: "#EFEBF2",
  noResultOutline: "#CFC6D6",

  /** Destructive actions (swipe-to-remove). White text. */
  remove: "#B42318",

  /** The camera's record button. */
  record: "#E5484D",

  /** The FSSAI pack marks: green dot (veg), brown triangle (non-veg). */
  veg: "#127A4E",
  nonVeg: "#7A3A05",
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
};

/**
 * One tint per relationship, so people are easy to tell apart in avatars
 * (onboarding tiles, family summary). Not verdict colours.
 */
export const relationshipTints: Record<
  Relationship,
  { background: string; text: string }
> = {
  self: { background: "#EAF0FA", text: "#2D5BA8" },
  spouse: { background: "#FFE7F0", text: "#A0285C" },
  parent: { background: "#FFE0DB", text: "#8E1010" },
  child: { background: "#D6F5E3", text: "#066638" },
  other: { background: "#FFEDC2", text: "#7A3A05" },
};

/** Keyed by the API's severity: green = Safe, yellow = Caution, red = Avoid. */
export const severityColors: Record<Severity, SeverityColors> = {
  green: {
    solid: "#127A4E",
    onSolid: "#FFFFFF",
    tint: "#D6F5E3",
    onTint: "#066638",
    outline: "#127A4E",
  },
  yellow: {
    solid: "#FFA51F",
    onSolid: colors.ink,
    tint: "#FFEDC2",
    onTint: "#7A3A05",
    outline: "#B45309",
  },
  red: {
    solid: "#9B1111",
    onSolid: "#FFFFFF",
    tint: "#FFE0DB",
    onTint: "#8E1010",
    outline: "#9B1111",
  },
};
