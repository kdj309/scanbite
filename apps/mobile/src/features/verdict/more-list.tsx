import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, toneColors, VERDICT_MARKS } from "@/components";
import { colors, radii, spacing } from "@/theme";
import type { MoreItem, VerdictView } from "./view";

/** "ok" (passed) looks like Safe. */
function look(tone: MoreItem["tone"]) {
  const verdict = tone === "ok" ? "green" : tone;
  const colors = toneColors(verdict);
  return {
    icon: VERDICT_MARKS[verdict],
    tint: colors.tint,
    color: colors.onTint,
  };
}

/**
 * "Also flagged (2)" / "What we checked": one card, header and rows
 * together. Starts open when it's short (design S2).
 */
export function MoreList({ more }: { more: VerdictView["more"] }) {
  const [open, setOpen] = useState(more.items.length <= 3);
  if (more.items.length === 0) {
    return null;
  }
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((shown) => !shown)}
        style={styles.toggle}
      >
        <Text variant="title">
          {more.title} ({more.items.length})
        </Text>
        <View style={styles.action}>
          <Text variant="label" color="brand">
            {open ? "Hide" : "See all"}
          </Text>
          <View style={open && styles.up}>
            <Icon name="chevronDown" size={16} color={colors.brandText} />
          </View>
        </View>
      </Pressable>
      {open &&
        more.items.map((item) => (
          <View key={item.title} style={styles.row}>
            <View
              style={[styles.mark, { backgroundColor: look(item.tone).tint }]}
            >
              <Icon
                name={look(item.tone).icon}
                size={13}
                color={look(item.tone).color}
              />
            </View>
            <View style={styles.text}>
              <Text variant="title">{item.title}</Text>
              <Text variant="caption">{item.detail}</Text>
            </View>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  up: { transform: [{ rotate: "180deg" }] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
});
