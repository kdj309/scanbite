import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts } from "@/theme";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

export type AvatarProps = {
  /** One or two characters, e.g. a name's first letter. */
  initials?: string;
  /** Drawn instead of initials (a character like ♥ turns into an emoji on Android). */
  icon?: IconName;
  size?: number;
  background?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A person's initial in a tinted circle. Decorative: the name is always
 * shown next to it, so screen readers skip it.
 */
export function Avatar({
  initials,
  icon,
  size = 38,
  background = colors.brandTint,
  color = colors.brandText,
  style,
}: AvatarProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size, backgroundColor: background },
        style,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={Math.round(size * 0.45)} color={color} />
      ) : (
        <Text
          variant="label"
          style={[
            styles.initials,
            { color, fontSize: Math.round(size * 0.34) },
          ]}
          maxFontSizeMultiplier={1}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontFamily: fonts.extrabold },
});
