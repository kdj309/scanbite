import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components";
import { colors, radii, spacing } from "@/theme";
import type { UndoBarProps } from "./scans.types";

/** "Removed from recent scans · Undo" along the bottom (design 1d). */
export function UndoBar({ text, onUndo, bottom }: UndoBarProps) {
  return (
    <View style={[styles.bar, { bottom }]} accessibilityLiveRegion="polite">
      <Text variant="label" color="onBrand" style={styles.text}>
        {text}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onUndo}
        hitSlop={spacing.xs}
        style={styles.undo}
      >
        <Text variant="label" style={styles.undoText}>
          Undo
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xxs,
    borderRadius: radii.md,
    backgroundColor: colors.ink,
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
  },
  text: { flex: 1 },
  undo: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  undoText: { color: colors.mango },
});
