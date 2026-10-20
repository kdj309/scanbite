import { StyleSheet, View } from "react-native";
import {
  Icon,
  type IconName,
  Text,
  toneColors,
  VERDICT_MARKS,
  type VerdictTone,
} from "@/components";
import { colors, fonts } from "@/theme";

/**
 * Someone's initial (or an icon) ringed in their verdict's colour, with its
 * mark in the corner, so it reads without colour too. Decorative: the
 * row or button around it says it in words.
 */
export function VerdictRing({
  initials,
  icon,
  severity,
  size = 30,
}: {
  initials?: string;
  icon?: IconName;
  severity: VerdictTone;
  size?: number;
}) {
  const tone = toneColors(severity);
  const mark = Math.round(size * 0.55);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: size >= 40 ? 3 : 2.5,
          borderColor: tone.outline,
        },
        severity === "none" && styles.dashed,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={Math.round(size * 0.45)} color={tone.onTint} />
      ) : (
        <Text
          style={[
            styles.initials,
            { color: tone.onTint, fontSize: Math.round(size * 0.37) },
          ]}
          maxFontSizeMultiplier={1}
        >
          {initials}
        </Text>
      )}
      <View
        style={[
          styles.mark,
          {
            width: mark,
            height: mark,
            borderRadius: mark / 2,
            backgroundColor: tone.solid,
          },
        ]}
      >
        <Icon
          name={VERDICT_MARKS[severity]}
          size={Math.round(mark * 0.58)}
          color={tone.onSolid}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  dashed: { borderStyle: "dashed" },
  initials: { fontFamily: fonts.extrabold },
  mark: {
    position: "absolute",
    right: -6,
    bottom: -6,
    borderWidth: 1.5,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
