import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing } from "@/theme";

export type StepProgressProps = {
  /** 1-based. */
  current: number;
  total: number;
  style?: StyleProp<ViewStyle>;
};

/** Segmented progress for a multi-step flow; announced as "Step 2 of 4". */
export function StepProgress({ current, total, style }: StepProgressProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={[styles.row, style]}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[styles.segment, index < current && styles.done]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  segment: {
    flex: 1,
    height: spacing.xs,
    borderRadius: 4,
    backgroundColor: colors.hairline,
  },
  done: { backgroundColor: colors.brand },
});
