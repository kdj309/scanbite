import type { ReactNode } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/theme";

/** Stroke icons from the design canvas, drawn on a 20×20 grid. */
const ICONS = {
  check: <Path d="M4 10L8 14L16 6" strokeWidth={2.2} />,
  /** Caution: ! in a circle. */
  alert: (
    <>
      <Circle cx={10} cy={10} r={8} strokeWidth={2} />
      <Path d="M10 6.5V11" strokeWidth={2} />
      <Circle cx={10} cy={13.6} r={1} fill="currentColor" stroke="none" />
    </>
  ),
  /** Avoid: × in a circle. */
  block: (
    <>
      <Circle cx={10} cy={10} r={8} strokeWidth={2} />
      <Path d="M7 7L13 13M13 7L7 13" strokeWidth={2} />
    </>
  ),
  close: <Path d="M5 5L15 15M15 5L5 15" strokeWidth={2.2} />,
  arrowRight: <Path d="M4 10H15M10 5L15 10L10 15" strokeWidth={2} />,
  chevronLeft: <Path d="M12 4L6 10L12 16" strokeWidth={2.2} />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  /**
   * Only for an icon that carries meaning on its own. Icons next to words
   * are decorative and hidden from screen readers (the default).
   */
  label?: string;
};

export function Icon({
  name,
  size = 20,
  color = colors.ink,
  label,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      color={color}
      accessible={label !== undefined}
      accessibilityRole={label !== undefined ? "image" : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={label === undefined}
      importantForAccessibility={
        label !== undefined ? "yes" : "no-hide-descendants"
      }
    >
      {ICONS[name]}
    </Svg>
  );
}
