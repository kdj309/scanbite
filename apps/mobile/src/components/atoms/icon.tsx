import type { ReactNode } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { colors } from "@/theme";

/** Stroke icons from the design canvas, drawn on a 20×20 grid. */
const ICONS = {
  check: <Path d="M4 10L8 14L16 6" strokeWidth={2.2} />,
  chevronLeft: <Path d="M12 4L6 10L12 16" strokeWidth={2.2} />,
  chevronRight: <Path d="M8 4L14 10L8 16" strokeWidth={2.2} />,
  chevronDown: <Path d="M4 8L10 14L16 8" strokeWidth={2.2} />,
  plus: <Path d="M10 4V16M4 10H16" strokeWidth={2.2} />,
  trash: <Path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11" strokeWidth={2} />,
  pencil: <Path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" strokeWidth={2} />,
  /** Verdict marks: Caution (!) and Avoid (×); Safe is `check`. */
  exclaim: (
    <>
      <Path d="M10 3.5V11" strokeWidth={3} />
      <Circle cx={10} cy={15.5} r={1.8} fill="currentColor" stroke="none" />
    </>
  ),
  close: <Path d="M5 5L15 15M15 5L5 15" strokeWidth={2.6} />,
  /** A product with no photo (read from its label). */
  package: (
    <Path
      d="M3 6.5L10 3.5L17 6.5V14L10 17L3 14ZM3 6.5L10 9.5L17 6.5M10 9.5V17"
      strokeWidth={1.6}
    />
  ),
  torch: <Path d="M11 2L4 11h5l-1 7 7-9h-5l1-7z" strokeWidth={1.9} />,
  /** "Scan the label again" (design 2c). */
  camera: (
    <>
      <Path
        d="M3 7.2A1.4 1.4 0 0 1 4.4 5.8h1.8L7.5 4h5l1.3 1.8h1.8A1.4 1.4 0 0 1 17 7.2v7.4A1.4 1.4 0 0 1 15.6 16H4.4A1.4 1.4 0 0 1 3 14.6Z"
        strokeWidth={1.8}
      />
      <Circle cx={10} cy={10.8} r={2.7} strokeWidth={1.8} />
    </>
  ),
  /** "No result": no verdict, never a severity mark (design 2c). */
  question: (
    <>
      <Circle cx={10} cy={10} r={8} strokeWidth={2} />
      <Path
        d="M7.8 7.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4"
        strokeWidth={2}
      />
      <Circle cx={10} cy={14.4} r={1} fill="currentColor" stroke="none" />
    </>
  ),
  // Tab bar icons, drawn on the canvas's 24×24 grid.
  home: (
    <G scale={20 / 24}>
      <Path
        d="M4 11L12 4L20 11V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"
        strokeWidth={2.2}
      />
    </G>
  ),
  scan: (
    <G scale={20 / 24}>
      <Path
        d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"
        strokeWidth={2.3}
      />
      <Path d="M8 9v6M11 9v6M14 9v6M17 9v6" strokeWidth={2.1} />
    </G>
  ),
  family: (
    <G scale={20 / 24}>
      <Circle cx={9} cy={8} r={3.2} strokeWidth={2.2} />
      <Circle cx={17} cy={9.5} r={2.4} strokeWidth={2.2} />
      <Path
        d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14.5 14.6c.8-.4 1.6-.6 2.5-.6 2.2 0 3.8 1.5 4.2 4"
        strokeWidth={2.2}
      />
    </G>
  ),
  heart: (
    <Path
      d="M10 17s-6.5-3.9-6.5-8.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 6.5 2.4C16.5 13.1 10 17 10 17z"
      fill="currentColor"
      stroke="none"
    />
  ),
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
