import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bitey, IconButton, Text } from "@/components";
import { screenGutter, spacing } from "@/theme";
import type { ComingNextProps } from "./placeholder.types";

/** Stands in for a screen that isn't built yet (scanner, verdict). */
export function ComingNext({ title }: ComingNextProps) {
  return (
    <SafeAreaView style={styles.screen}>
      {router.canGoBack() && (
        <IconButton
          icon="chevronLeft"
          label="Back"
          onPress={() => router.back()}
        />
      )}
      <View style={styles.center}>
        <Bitey size={110} />
        <Text variant="h1">{title}</Text>
        <Text color="secondary">Coming next.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.xs },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: screenGutter,
  },
});
