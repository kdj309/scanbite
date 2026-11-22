import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { Icon, Text } from "@/components";
import { colors, radii } from "@/theme";

/** Looks like a field; opens search, where the typing happens (design 1, 1e). */
export function SearchBar() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Search a product or brand"
      onPress={() => router.push("/search")}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <Icon name="search" size={20} color={colors.inkSecondary} />
      <Text color="secondary">Search a product or brand</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.brandTint },
});
