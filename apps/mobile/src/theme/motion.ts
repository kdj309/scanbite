import { Easing } from "react-native";

/**
 * Timings from the design's animations. Every animation is skipped when the
 * phone has Reduce Motion on (AccessibilityInfo.isReduceMotionEnabled).
 */
export const durations = {
  /** Scrim fade, tab and pill changes. */
  fast: 250,
  /** Content rising in, stagger steps add 100 each. */
  rise: 500,
  /** Bottom sheet sliding up. */
  sheet: 450,
  /** Verdict badge pop. */
  pop: 550,
  stagger: 100,
} as const;

export const easings = {
  /** Rise and fade. */
  out: Easing.out(Easing.ease),
  /** Sheets: quick start, soft landing. */
  sheet: Easing.bezier(0.2, 0.8, 0.2, 1),
  /** Badge pop: slight overshoot. */
  pop: Easing.bezier(0.2, 0.9, 0.3, 1.3),
} as const;
