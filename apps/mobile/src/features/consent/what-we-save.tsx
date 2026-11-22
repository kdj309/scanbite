import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "@/components";
import { colors, radii, spacing } from "@/theme";
import type { SavedItem } from "./consent.types";

/** Each kind of data with its purpose, so the notice stands on its own (DPDP Rules 2025, r.3). */
const SAVED: readonly SavedItem[] = [
  { what: "Names", why: "To show whose result is whose" },
  { what: "Age bands", why: "To use the right limits" },
  { what: "Conditions", why: "To check salt, sugar and more" },
  { what: "Allergies", why: "To warn about allergens" },
  { what: "Your yes, and when", why: "To prove you agreed" },
];

/** "What we save, and why" (design 0c): folded, one tap shows it (a layered notice). */
export function WhatWeSave() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.head}
      >
        <Text variant="title" color="brand">
          What we save, and why
        </Text>
        <Icon
          name={open ? "chevronDown" : "chevronRight"}
          size={18}
          color={colors.brandText}
        />
      </Pressable>
      {open && (
        <View style={styles.list}>
          {SAVED.map((item) => (
            <View key={item.what} style={styles.row}>
              <Text variant="bodyStrong">{item.what}</Text>
              <Text variant="caption" style={styles.why}>
                {item.why}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  list: {
    marginHorizontal: 14,
    paddingBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  why: { flexShrink: 1, textAlign: "right" },
});
