import { Pressable, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "@/components/atoms/icon";
import { Text } from "@/components/atoms/text";
import { colors, radii, spacing } from "@/theme";

export type LinkRowProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

/** A card that opens another screen: icon, label, chevron ("Privacy & data ›"). */
export function LinkRow({ icon, label, onPress }: LinkRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.tile}>
        <Icon name={icon} size={18} color={colors.brandText} />
      </View>
      <Text variant="title" style={styles.label}>
        {label}
      </Text>
      <Icon name="chevronRight" size={18} color={colors.brandText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.brandTint },
  tile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTint,
  },
  label: { flex: 1 },
});
