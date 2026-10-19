import type { HouseholdMember, Severity } from "@foodscanner/shared";
import { StyleSheet, View } from "react-native";
import { Icon, type IconName, Text } from "@/components";
import { memberInitials } from "@/features/household/member-avatar";
import { colors, fonts, severityColors } from "@/theme";

const MARKS: Record<Severity, IconName> = {
  green: "check",
  yellow: "exclaim",
  red: "close",
};

/**
 * Someone's initial ringed in their verdict's colour, with its mark in the
 * corner, so it reads without colour too. Screen readers get the row's
 * summary instead.
 */
export function VerdictRing({
  member,
  severity,
}: {
  member: Pick<HouseholdMember, "relationship" | "name">;
  severity: Severity;
}) {
  const tone = severityColors[severity];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { borderColor: tone.outline }]}
    >
      <Text
        style={[styles.initials, { color: tone.onTint }]}
        maxFontSizeMultiplier={1}
      >
        {memberInitials(member)}
      </Text>
      <View style={[styles.mark, { backgroundColor: tone.solid }]}>
        <Icon name={MARKS[severity]} size={11} color={tone.onSolid} />
      </View>
    </View>
  );
}

const SIZE = 30;

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  initials: { fontFamily: fonts.extrabold, fontSize: 11, lineHeight: 14 },
  mark: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
