import { router, type Href } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bitey, Button, Icon, SpeechBubble, Text } from "@/components";
import { useFinishSetup } from "@/features/onboarding/setup-seen";
import { colors, radii, screenGutter, spacing } from "@/theme";
import { useAgreeToHealthInfo } from "./api";
import type { ConsentPoint, ConsentScreenProps } from "./consent.types";

/**
 * The full privacy policy, linked from the notice. To be published before
 * launch (roadmap: Before launch).
 */
export const PRIVACY_POLICY_URL = "https://scanbite.in/privacy";

const POINTS: readonly ConsentPoint[] = [
  { icon: "lock", text: "Only used to check food for your family" },
  { icon: "never", text: "Never sold or shared" },
  { icon: "trash", text: "Delete it any time" },
];

/**
 * Health info consent (design 0b, DPDP Act 2023): before anyone's health
 * info is entered. "I agree" and "I don't agree" are equally easy; declining
 * still leaves scanning with general results.
 */
export function ConsentScreen({
  next,
  returnAfter,
  fromSetup,
}: ConsentScreenProps) {
  const agree = useAgreeToHealthInfo();
  const finishSetup = useFinishSetup();

  const onAgree = () =>
    agree.mutate(undefined, {
      onSuccess: () => {
        if (returnAfter) router.back();
        else router.replace(next as Href);
      },
    });
  const onDecline = () => {
    // From first-run setup, declining skips setup like "I'll just scan".
    if (fromSetup) {
      void finishSetup("/");
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.intro}>
        <Bitey size={72} />
        <SpeechBubble style={styles.bubble}>
          Before I ask about health, here's how I keep it safe.
        </SpeechBubble>
      </View>
      <View style={styles.body}>
        <Text variant="h1" accessibilityRole="header">
          Your family's health info
        </Text>
        {POINTS.map((point) => (
          <View key={point.text} style={styles.point}>
            <View style={styles.iconTile}>
              <Icon name={point.icon} size={22} color={colors.brandText} />
            </View>
            <Text variant="title" style={styles.fill}>
              {point.text}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Text variant="caption" style={styles.centered}>
          By tapping I agree, you confirm you're 18 or older and agree to our{" "}
          <Text
            variant="caption"
            color="brand"
            accessibilityRole="link"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          >
            Privacy policy
          </Text>
          .
        </Text>
        <Button title="I agree" onPress={onAgree} loading={agree.isPending} />
        <Button
          title="I don't agree"
          variant="secondary"
          onPress={onDecline}
          disabled={agree.isPending}
        />
        <Text variant="caption" style={styles.centered}>
          You can still scan products and see general results.
        </Text>
        {agree.isError && (
          <Text
            variant="caption"
            accessibilityRole="alert"
            style={styles.centered}
          >
            Couldn't save that. Try again.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  centered: { textAlign: "center" },
  intro: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.lg,
  },
  bubble: { flex: 1, marginBottom: 18 },
  body: {
    flex: 1,
    gap: spacing.sm,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.lg,
  },
  point: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTint,
  },
  actions: {
    gap: 10,
    paddingHorizontal: screenGutter,
    paddingBottom: spacing.lg,
  },
});
