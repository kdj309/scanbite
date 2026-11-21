import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { useReducedMotion } from "./use-reduced-motion";

/** 0→1 over `duration`, repeating; stays at 0 with Reduce Motion on. */
export function useLoop(duration: number): Animated.Value {
  const reduced = useReducedMotion();
  // Created once; state, not a ref, so render never reads a ref.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    if (reduced) {
      return;
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [duration, progress, reduced]);

  return progress;
}
