import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Text } from "@/components";
import { listName } from "@/features/household/members";
import { colors, radii, spacing } from "@/theme";
import type { ScanForProps } from "./home.types";

/**
 * "Scan for Everyone · Amma · Papa" on Home's blue header (design S1).
 * Only shown when 2+ people have conditions: with one, there's no choice.
 */
export function ScanFor({ checked, selectedId, onSelect }: ScanForProps) {
  const options = [
    { id: undefined, label: "Everyone" },
    ...checked.map((member) => ({ id: member.id, label: listName(member) })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel="Who are you scanning for"
      contentContainerStyle={styles.row}
    >
      <Text variant="label" color="onBrand">
        Scan for
      </Text>
      {options.map(({ id, label }) => {
        const selected = id === selectedId;
        return (
          <Pressable
            key={id ?? "everyone"}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onSelect(id)}
            style={[styles.pill, selected && styles.selected]}
          >
            <Text
              variant="label"
              color={selected ? "brand" : "onBrand"}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", gap: spacing.xs },
  pill: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  selected: { backgroundColor: colors.surface, borderColor: colors.surface },
});
