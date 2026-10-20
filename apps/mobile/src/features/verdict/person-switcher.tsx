import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SEVERITY_WORDS, Text, type VerdictTone } from "@/components";
import { VerdictRing } from "@/features/scans/verdict-ring";
import { colors, radii, spacing } from "@/theme";
import { ALL, type PersonOption } from "./view";

const WORDS: Record<VerdictTone, string> = {
  ...SEVERITY_WORDS,
  none: "Add info",
};

/** "See it for": each person as a ring in their verdict (design S2). */
export function PersonSwitcher({
  options,
  selected,
  onSelect,
}: {
  options: readonly PersonOption[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  // With All + 5 people the names stop fitting: fixed-width tiles scroll.
  const crowded = options.length >= 6;
  return (
    <View>
      <Text variant="caption" style={styles.heading}>
        See it for
      </Text>
      <ScrollView
        horizontal
        scrollEnabled={crowded}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, !crowded && styles.fit]}
        accessibilityRole="radiogroup"
        accessibilityLabel="See it for"
      >
        {options.map((option) => {
          const on = option.id === selected;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${option.name}, ${WORDS[option.severity]}`}
              onPress={() => onSelect(option.id)}
              style={[
                styles.person,
                crowded ? styles.fixed : styles.flex,
                on && styles.on,
              ]}
            >
              <VerdictRing
                severity={option.severity}
                size={40}
                {...(option.id === ALL
                  ? { icon: "family" as const }
                  : { initials: option.name.charAt(0).toUpperCase() })}
              />
              <Text variant="label" numberOfLines={1}>
                {option.name}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {WORDS[option.severity]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: spacing.xxs, paddingBottom: 6 },
  row: { flexDirection: "row", gap: 6 },
  fit: { flexGrow: 1 },
  flex: { flex: 1 },
  fixed: { width: 66 },
  person: {
    alignItems: "center",
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  on: {
    backgroundColor: colors.surface,
    borderColor: colors.brand,
    boxShadow: "0 4px 12px rgba(58,110,196,0.15)",
  },
});
