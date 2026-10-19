/** Spacing steps the screens use; 20 is the screen edge. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const screenGutter = spacing.lg;

export const radii = {
  /** Small flags, veg mark corners. */
  xs: 8,
  /** Thumbnails, icon buttons. */
  sm: 12,
  /** Chips in rows, member switcher cells. */
  md: 14,
  /** Cards, buttons. */
  lg: 16,
  /** Verdict hero, scan button. */
  xl: 20,
  /** Top corners of bottom sheets. */
  sheet: 28,
  pill: 999,
} as const;

/** Anything tappable is at least this tall and wide. */
export const minTouchTarget = 44;

/** Primary and secondary buttons. */
export const buttonHeight = 54;

/** CSS-style shadows (React Native's boxShadow, New Architecture). */
export const shadows = {
  /** Speech bubbles and banners that sit above content. */
  raised: "0 4px 14px rgba(26,21,35,0.08)",
  /** The primary button's pressable edge. */
  primaryEdge: "0 4px 0 #2D5BA8",
  primaryEdgePressed: "0 1px 0 #2D5BA8",
  mangoEdge: "0 6px 0 #C99A00",
  mangoEdgePressed: "0 2px 0 #C99A00",
  /** Home's scan card, lifted off the blue header. */
  card: "0 10px 24px rgba(26,21,35,0.18)",
  /** Small floating art, e.g. the barcode card in Home's empty state. */
  float: "0 6px 16px rgba(26,21,35,0.15)",
  /** The centre scan button in the tab bar. */
  scanButton: "0 6px 16px rgba(58,110,196,0.35)",
} as const;
