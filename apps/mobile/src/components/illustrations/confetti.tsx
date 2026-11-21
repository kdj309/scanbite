import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { colors, severityColors } from "@/theme";

/** The design's 14 pieces: across a 390-wide frame, delay and fall time in s. */
const PIECES: ReadonlyArray<
  [x: number, color: string, delay: number, fall: number]
> = [
  [20, colors.mango, 0, 3.0],
  [60, colors.brand, 0.6, 3.4],
  [100, severityColors.green.solid, 1.2, 2.8],
  [140, severityColors.red.solid, 0.3, 3.6],
  [180, colors.mango, 1.6, 3.1],
  [220, colors.brand, 0.9, 2.9],
  [260, severityColors.green.solid, 0.2, 3.5],
  [300, colors.mango, 1.3, 3.2],
  [340, severityColors.red.solid, 0.7, 3.0],
  [40, colors.brand, 2.0, 3.3],
  [200, colors.mango, 2.3, 2.7],
  [320, colors.brand, 1.9, 3.4],
  [120, colors.mango, 2.6, 3.0],
  [280, severityColors.red.solid, 2.9, 3.2],
];

/** Falling celebration pieces. Decorative; nothing at all with Reduce Motion. */
export function Confetti() {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  if (reduced) {
    return null;
  }
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {PIECES.map(([x, color, delay, fall], index) => (
        <Piece
          key={index}
          left={(x / 390) * width}
          color={color}
          delayMs={delay * 1000}
          fallMs={fall * 1000}
          distance={height + 60}
        />
      ))}
    </View>
  );
}

export interface PieceProps {
  left: number;
  color: string;
  delayMs: number;
  fallMs: number;
  distance: number;
}

function Piece({ left, color, delayMs, fallMs, distance }: PieceProps) {
  // Created once; state, not a ref, so render never reads a ref.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: fallMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const start = setTimeout(() => loop.start(), delayMs);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [progress, delayMs, fallMs]);

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left,
          backgroundColor: color,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-60, distance],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "620deg"],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: "absolute",
    top: 0,
    width: 10,
    height: 16,
    borderRadius: 3,
  },
});
