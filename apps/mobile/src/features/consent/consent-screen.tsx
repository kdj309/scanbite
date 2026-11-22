import { router, type Href } from "expo-router";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bitey, Button, Icon, SpeechBubble, Text } from "@/components";
import { useFinishSetup } from "@/features/onboarding/setup-seen";
import { colors, radii, screenGutter, spacing } from "@/theme";
import { useAgreeToHealthInfo } from "./api";
import type { ConsentPoint, ConsentScreenProps } from "./consent.types";
import { WhatWeSave } from "./what-we-save";

/**
 * The full privacy policy, linked from the notice. To be published before
 * launch (roadmap: Before launch).
 */
export const PRIVACY_POLICY_URL = "https://scanbite.in/privacy";

const POINTS: readonly ConsentPoint[] = [
  { icon: "lock", text: "Only to check your food" },
  { icon: "never", text: "Never sold" },
  { icon: "trash", text: "Delete any time" },
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
          Your health info stays safe with me.
        </SpeechBubble>
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.body}>
        <Text variant="h1" accessibilityRole="header">
          Your family's health info
        </Text>
        {POINTS.map((point) => (
          <View key={point.text} style={styles.point}>
            <View style={styles.iconTile}>
              <Icon name={point.icon} size={20} color={colors.brandText} />
            </View>
            <Text variant="title" style={styles.fill}>
              {point.text}
            </Text>
          </View>
        ))}
        <WhatWeSave />
      </ScrollView>
      <View style={styles.actions}>
        <Text variant="caption" style={styles.centered}>
          I'm 18+ and agree to the{" "}
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
          You can still scan.
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
    gap: 10,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  point: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  iconTile: {
    width: 38,
    height: 38,
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
