import { useEffect, useState } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { colors } from "@/theme";

/** Bitey's own palette (design canvas); not used anywhere else. */
const BODY = colors.brand;
const BELLY = "#5B8BDB";
const FEET = colors.brandText;
const LEAF_DARK = "#127A4E";
const LEAF_LIGHT = "#3FA66B";
const TONGUE = "#FF8FA0";

export type BiteyMotion = "bob" | "jump" | "still";

export type BiteyProps = {
  /** Width in points; height follows the drawing (120×130). */
  size?: number;
  motion?: BiteyMotion;
  style?: StyleProp<ViewStyle>;
};

/**
 * The mascot. Decorative, so screen readers skip it. Bobs or jumps and
 * blinks, unless the phone has Reduce Motion on.
 */
export function Bitey({ size = 64, motion = "bob", style }: BiteyProps) {
  const reduced = useReducedMotion();
  const animate = !reduced && motion !== "still";
  // Created once; state, not a ref, so render never reads a ref.
  const [progress] = useState(() => new Animated.Value(0));
  const blinking = useBlink(animate);

  useEffect(() => {
    progress.setValue(0);
    if (!animate) {
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: KEYFRAMES[motion].duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animate, motion, progress]);

  const frames = KEYFRAMES[motion];
  const scale = size / 120;
  const translateY = progress.interpolate({
    inputRange: frames.at,
    outputRange: frames.lift.map((points) => points * scale),
  });
  const rotate = progress.interpolate({
    inputRange: frames.at,
    outputRange: frames.tilt.map((degrees) => `${degrees}deg`),
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ transform: [{ translateY }, { rotate }] }, style]}
    >
      <Svg width={size} height={(size * 130) / 120} viewBox="0 0 120 130">
        <Path d="M60 22c0-9 5-15 14-16-1 9-6 15-14 16z" fill={LEAF_DARK} />
        <Path d="M60 22c0-7-4-11-10-12 1 7 4 11 10 12z" fill={LEAF_LIGHT} />
        <Rect x={14} y={22} width={92} height={88} rx={34} fill={BODY} />
        <Ellipse cx={60} cy={98} rx={24} ry={9} fill={BELLY} />
        <Path
          d="M6 38V24a10 10 0 0 1 10-10h12"
          stroke={colors.mango}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M114 38V24a10 10 0 0 0-10-10H92"
          stroke={colors.mango}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        {blinking ? (
          <G>
            <Ellipse cx={45} cy={57} rx={10} ry={1.4} fill={colors.ink} />
            <Ellipse cx={75} cy={57} rx={10} ry={1.4} fill={colors.ink} />
          </G>
        ) : (
          <G>
            <Ellipse cx={45} cy={57} rx={10} ry={12} fill={colors.surface} />
            <Ellipse cx={75} cy={57} rx={10} ry={12} fill={colors.surface} />
            <Circle cx={47} cy={59} r={5.2} fill={colors.ink} />
            <Circle cx={77} cy={59} r={5.2} fill={colors.ink} />
            <Circle cx={49} cy={56.5} r={1.8} fill={colors.surface} />
            <Circle cx={79} cy={56.5} r={1.8} fill={colors.surface} />
          </G>
        )}
        <Path
          d="M50 75Q60 89 70 75Z"
          fill={colors.ink}
          stroke={colors.ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <Path d="M55 81.5Q60 86.5 65 81.5Q60 79 55 81.5Z" fill={TONGUE} />
        <Ellipse cx={42} cy={114} rx={13} ry={7} fill={FEET} />
        <Ellipse cx={78} cy={114} rx={13} ry={7} fill={FEET} />
      </Svg>
    </Animated.View>
  );
}

/** The design's keyframes: when (0–1), how high, how tilted. */
const KEYFRAMES: Record<
  BiteyMotion,
  { duration: number; at: number[]; lift: number[]; tilt: number[] }
> = {
  bob: { duration: 2600, at: [0, 0.5, 1], lift: [0, -7, 0], tilt: [0, 0, 0] },
  jump: {
    duration: 1400,
    at: [0, 0.35, 0.55, 0.7, 1],
    lift: [0, -26, 0, -10, 0],
    tilt: [0, -6, 0, 4, 0],
  },
  still: { duration: 1, at: [0, 1], lift: [0, 0], tilt: [0, 0] },
};

/** Eyes close for 150 ms every 4.5 s. */
function useBlink(enabled: boolean): boolean {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let reopen: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      setClosed(true);
      reopen = setTimeout(() => setClosed(false), 150);
    }, 4500);
    return () => {
      clearInterval(timer);
      clearTimeout(reopen);
    };
  }, [enabled]);
  return enabled && closed;
}
