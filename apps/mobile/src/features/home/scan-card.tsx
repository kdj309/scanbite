import { router } from "expo-router";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "@/components";
import { useLoop } from "@/hooks/use-loop";
import {
  buttonHeight,
  colors,
  radii,
  severityColors,
  shadows,
  spacing,
} from "@/theme";
import type { ScanCardProps } from "./home.types";

/** Home's big scan button (design S1): who it checks, then "Open scanner". */
export function ScanCard({ title, subtitle, memberId }: ScanCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityHint="Opens the scanner"
      onPress={() =>
        router.push({
          pathname: "/scan",
          params: memberId ? { for: memberId } : {},
        })
      }
      style={styles.card}
    >
      {({ pressed }) => (
        <>
          <View style={styles.top}>
            <ScanIcon />
            <View style={styles.text}>
              <Text variant="h1">{title}</Text>
              <Text variant="caption">{subtitle}</Text>
            </View>
          </View>
          <View style={[styles.button, pressed && styles.buttonPressed]}>
            <Text variant="button" color="onBrand">
              Open scanner
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

/** The mango barcode tile with a scan line sweeping over it. */
function ScanIcon() {
  const progress = useLoop(1600);
  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 42, 0],
  });
  return (
    <View style={styles.icon}>
      <Icon name="scan" size={38} color={colors.ink} />
      <Animated.View style={[styles.line, { transform: [{ translateY }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    boxShadow: shadows.card,
  },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.mango,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  line: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: severityColors.red.solid,
  },
  button: {
    height: buttonHeight,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    boxShadow: shadows.primaryEdge,
  },
  buttonPressed: {
    backgroundColor: colors.brandText,
    boxShadow: shadows.primaryEdgePressed,
    transform: [{ translateY: 3 }],
  },
});
