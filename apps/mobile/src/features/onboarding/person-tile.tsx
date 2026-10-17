import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icon, IconButton, Text } from "@/components";
import {
  colors,
  minTouchTarget,
  radii,
  severityColors,
  spacing,
} from "@/theme";

/** How far the corner button (› or ✎) sits from the tile's edge. */
const CORNER_INSET = 2;

type PersonTileProps = {
  title: string;
  subtitle: string;
  /** e.g. an Avatar above the title. */
  leading: ReactNode;
  style?: StyleProp<ViewStyle>;
} & (
  | {
      /** Not added yet: the tile is a button that starts this person. */
      onPress: () => void;
      edit?: never;
    }
  | {
      /** Added: shown as done, with its own edit button. */
      edit: { label: string; onPress: () => void };
      onPress?: never;
    }
);

/** A "Who do you shop for?" tile: one person, to add or already added. */
export function PersonTile({
  title,
  subtitle,
  leading,
  style,
  onPress,
  edit,
}: PersonTileProps) {
  const content = (
    <>
      {leading}
      <Text variant="h2">{title}</Text>
      {/* Wraps before the corner button (› or ✎), never under it. */}
      <Text variant="caption" style={styles.subtitle}>
        {subtitle}
      </Text>
    </>
  );

  if (edit) {
    return (
      <View style={[styles.tile, style]}>
        {/* One element for screen readers: "Partner, Priya, added". */}
        <View accessible accessibilityLabel={`${title}, ${subtitle}, added`}>
          {content}
        </View>
        <View
          style={styles.tag}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name="check" size={12} color={severityColors.green.onTint} />
          <Text variant="label" style={styles.tagText}>
            Added
          </Text>
        </View>
        {/* Beside the label, not inside it, so it's its own button. */}
        <IconButton
          icon="pencil"
          label={edit.label}
          color={colors.brandText}
          onPress={edit.onPress}
          style={styles.corner}
        />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, style]}
    >
      {content}
      <View style={styles.corner}>
        <Icon name="chevronRight" color={colors.brandText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: minTouchTarget,
    gap: 6,
    padding: spacing.sm,
    paddingTop: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { borderColor: colors.brandBorderPressed },
  // The corner button's width plus its inset, less the tile's padding.
  subtitle: { marginRight: minTouchTarget + CORNER_INSET - spacing.sm },
  tag: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: severityColors.green.tint,
  },
  tagText: { color: severityColors.green.onTint },
  corner: {
    position: "absolute",
    right: CORNER_INSET,
    bottom: CORNER_INSET,
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
