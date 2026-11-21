import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text } from "@/components";
import { colors, radii, severityColors } from "@/theme";
import type { PermissionTickProps } from "./add-person.types";

/**
 * "I'm Aarav's parent or guardian" (design 8c): confirmed once, when a
 * person is added, before their health info. Next without it shows a
 * short prompt here rather than a disabled button.
 */
export function PermissionTick({
  label,
  checked,
  onToggle,
  asked,
}: PermissionTickProps) {
  const prompting = asked && !checked;
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={[
          styles.row,
          checked && styles.rowOn,
          prompting && styles.rowAsk,
        ]}
      >
        <View style={[styles.box, checked && styles.boxOn]}>
          {checked && <Icon name="check" size={14} color={colors.onBrand} />}
        </View>
        <Text variant="title" style={styles.label}>
          {label}
        </Text>
      </Pressable>
      {prompting && (
        <View style={styles.prompt} accessibilityRole="alert">
          <Icon name="exclaim" size={14} color={severityColors.yellow.onTint} />
          <Text variant="label" style={styles.promptText}>
            Tick this to add their health info
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  rowOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  rowAsk: {
    borderColor: severityColors.yellow.solid,
    backgroundColor: severityColors.yellow.tint,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.inkSecondary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  label: { flex: 1 },
  prompt: { flexDirection: "row", alignItems: "center", gap: 6 },
  promptText: { color: severityColors.yellow.onTint },
});
