import { StyleSheet, View, type ViewProps } from "react-native";
import { Text } from "@/components/atoms/text";
import { colors, shadows, spacing } from "@/theme";

export type SpeechBubbleProps = ViewProps & { children: string };

/** What Bitey says. */
export function SpeechBubble({ children, style, ...rest }: SpeechBubbleProps) {
  return (
    <View {...rest} style={[styles.bubble, style]}>
      <Text variant="title">{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    boxShadow: shadows.raised,
  },
});
