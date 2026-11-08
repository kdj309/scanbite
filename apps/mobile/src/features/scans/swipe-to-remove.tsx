import { type ReactNode, useEffect, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Icon, Text } from "@/components";
import { colors } from "@/theme";

const REMOVE_WIDTH = 96;

/**
 * A row that swipes left to show "Remove" (design 1d). The row narrows to
 * make room rather than sliding off, so its name stays where it was. One
 * row is open at a time: the parent says which.
 */
export function SwipeToRemove({
  open,
  onOpenChange,
  onRemove,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  /** Read out for the Remove button, e.g. "Remove Delhi mixture". */
  label: string;
  children: ReactNode;
}) {
  const [swipe] = useState(createSwipe);
  useEffect(() => swipe.onSettle(onOpenChange), [swipe, onOpenChange]);
  useEffect(() => swipe.settle(open), [swipe, open]);

  return (
    <View style={styles.host}>
      {/* Under the row, uncovered as it narrows. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        onPress={onRemove}
        style={styles.remove}
      >
        <Icon name="trash" size={20} color={colors.onBrand} />
        <Text variant="label" color="onBrand">
          Remove
        </Text>
      </Pressable>
      <Animated.View
        {...swipe.handlers}
        style={[styles.row, { marginRight: swipe.reveal }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * The drag, made once per row and kept out of render: how far Remove is
 * uncovered, and the gesture that moves it.
 */
function createSwipe() {
  const reveal = new Animated.Value(0);
  let start = 0;
  let notify: (open: boolean) => void = () => undefined;
  const settle = (open: boolean) =>
    Animated.spring(reveal, {
      toValue: open ? REMOVE_WIDTH : 0,
      useNativeDriver: false,
      bounciness: 0,
    }).start();
  const { panHandlers } = PanResponder.create({
    // Only a mostly sideways drag: up and down still scrolls the list, and
    // a tap still reaches the row. Captured, so the row's own press
    // handling doesn't keep the drag.
    onMoveShouldSetPanResponderCapture: (_e, g) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      reveal.stopAnimation((value) => {
        start = value;
      });
    },
    onPanResponderMove: (_e, g) => {
      reveal.setValue(Math.min(REMOVE_WIDTH, Math.max(0, start - g.dx)));
    },
    onPanResponderRelease: (_e, g) => {
      const shown = Math.max(0, start - g.dx);
      const opening = g.vx < -0.3 || (g.vx <= 0.3 && shown > REMOVE_WIDTH / 2);
      // Settle here too: when `open` doesn't change, nothing else would.
      settle(opening);
      notify(opening);
    },
  });
  return {
    reveal,
    handlers: panHandlers,
    settle,
    /** Who to tell when a drag ends open or closed. */
    onSettle: (callback: (open: boolean) => void) => {
      notify = callback;
    },
  };
}

const styles = StyleSheet.create({
  host: { overflow: "hidden" },
  remove: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: REMOVE_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.remove,
  },
  row: { backgroundColor: colors.background },
});
