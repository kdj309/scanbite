import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, IconButton, Text } from "@/components";
import {
  colors,
  radii,
  screenGutter,
  spacing,
  sheetBottomPadding,
} from "@/theme";
import type { WhySheetProps } from "./verdict.types";

/** "Why does this matter?" for one rule (design S3). */
export function WhySheet({ explainer, forWhom, onClose }: WhySheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={explainer !== undefined}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityLabel="Close"
        onPress={onClose}
      />
      {explainer && (
        <View
          style={[
            styles.sheet,
            { paddingBottom: sheetBottomPadding(insets.bottom) },
          ]}
        >
          <View style={styles.head}>
            <Text variant="h1" accessibilityRole="header" style={styles.fill}>
              {explainer.title}
            </Text>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text>{explainer.explainer}</Text>
            {explainer.addendum && (
              <View style={styles.personal}>
                {forWhom && (
                  <Text variant="label" color="brand" style={styles.chip}>
                    {forWhom}
                  </Text>
                )}
                <Text>{explainer.addendum}</Text>
              </View>
            )}
            <Text variant="caption">Source: {explainer.citations}</Text>
          </ScrollView>
          <Button title="Got it" variant="secondary" onPress={onClose} />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(26,21,35,0.45)" },
  sheet: {
    maxHeight: "85%",
    gap: spacing.sm,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  body: { gap: spacing.sm },
  personal: {
    gap: 6,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.brandTint,
  },
  chip: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xxs,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
});
