import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, screenGutter, spacing } from "@/theme";
import { IconButton } from "../atoms/icon-button";
import { DotPattern } from "../illustrations/dot-pattern";

export type BrandScreenProps = {
  /** Under the back button, on brand blue: the title and anything with it. */
  header: ReactNode;
  /** The sheet that overlaps the header's bottom edge. */
  children: ReactNode;
  onBack: () => void;
};

/** A pushed screen with a blue dotted header and a rounded sheet over it. */
export function BrandScreen({ header, children, onBack }: BrandScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.fill}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <DotPattern />
        <View style={styles.bar}>
          <IconButton
            icon="chevronLeft"
            label="Back"
            color={colors.onBrand}
            onPress={onBack}
            style={styles.barButton}
          />
        </View>
        {header}
      </View>
      <View style={styles.sheet}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    gap: spacing.xs,
    paddingHorizontal: screenGutter,
    paddingBottom: 40,
    overflow: "hidden",
    backgroundColor: colors.brand,
  },
  bar: { flexDirection: "row", paddingVertical: spacing.xs },
  barButton: { backgroundColor: "rgba(255,255,255,0.16)" },
  sheet: {
    flex: 1,
    marginTop: -26,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
});
