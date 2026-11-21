import { router, Stack } from "expo-router";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Icon, IconButton, LinkRow, Text } from "@/components";
import { useMe, useWithdrawHealthConsent } from "@/features/consent/api";
import { askHealthConsent } from "@/features/consent/ask";
import { PRIVACY_POLICY_URL } from "@/features/consent/consent-screen";
import { colors, screenGutter, severityColors, spacing } from "@/theme";
import { useDeleteAccount, useStartAgain } from "./api";
import type { AccountDeletedProps, ConsentCardProps } from "./privacy.types";

/** The policy's "Contact and grievances" section. */
const CONTACT_URL = `${PRIVACY_POLICY_URL}#contact`;

/**
 * Privacy & data (design 13b), from Family and Your profile: health-info
 * consent (withdraw), the policy and contact, and deleting the account.
 */
export function PrivacyScreen() {
  const me = useMe();
  const remove = useDeleteAccount();
  const startAgain = useStartAgain();

  if (remove.isSuccess) {
    return <AccountDeleted onStartAgain={startAgain} />;
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "Your family and their health info, your scans and label photos, and your sign-in on every device. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => remove.mutate(),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bar}>
        <IconButton
          icon="chevronLeft"
          label="Back"
          onPress={() => router.back()}
        />
        <Text variant="h2" accessibilityRole="header">
          Privacy & data
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="label" color="secondary" style={styles.section}>
          Health info
        </Text>
        {me.data ? (
          // Any agreement on record, even to an older notice: health info
          // saved under it can still be withdrawn.
          <ConsentCard consent={me.data.user.health_consent} />
        ) : (
          <Card>
            <Text variant="caption">
              {me.isError ? "Can't load this right now." : "Loading…"}
            </Text>
          </Card>
        )}
        <Text variant="label" color="secondary" style={styles.section}>
          Policy and help
        </Text>
        <LinkRow
          icon="lock"
          label="Privacy policy"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        />
        <LinkRow
          icon="question"
          label="Contact us"
          onPress={() => void Linking.openURL(CONTACT_URL)}
        />
      </ScrollView>
      <View style={styles.footer}>
        {remove.isError && (
          <Text variant="caption" accessibilityRole="alert">
            Couldn't delete your account. {remove.error.message}
          </Text>
        )}
        <Button
          title="Delete account"
          variant="danger"
          onPress={confirmDelete}
          loading={remove.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

/** Agreed (with the date) and Withdraw, or not agreed and Review. */
function ConsentCard({ consent }: ConsentCardProps) {
  const withdraw = useWithdrawHealthConsent();

  function confirmWithdraw() {
    Alert.alert(
      "Withdraw consent?",
      "We'll delete everyone's conditions and allergies. Names stay; results become general.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: () => withdraw.mutate(),
        },
      ]
    );
  }

  if (!consent) {
    return (
      <Card style={styles.card}>
        <View style={styles.status}>
          <View style={[styles.dot, styles.dotOff]}>
            <Icon name="close" size={14} color={colors.onBrand} />
          </View>
          <Text variant="h2">Not agreed</Text>
        </View>
        <Text variant="caption" style={styles.indent}>
          Results are general
        </Text>
        <Button
          title="Review and agree"
          variant="link"
          onPress={askHealthConsent}
          style={styles.indent}
        />
      </Card>
    );
  }
  return (
    <Card style={styles.card}>
      <View style={styles.status}>
        <View style={[styles.dot, styles.dotOn]}>
          <Icon name="check" size={14} color={colors.onBrand} />
        </View>
        <Text variant="h2">You agreed</Text>
      </View>
      <Text variant="caption" style={styles.indent}>
        {agreedOn(consent.agreed_at)}
      </Text>
      {withdraw.isError && (
        <Text variant="caption" accessibilityRole="alert" style={styles.indent}>
          Couldn't withdraw. {withdraw.error.message}
        </Text>
      )}
      <Button
        title="Withdraw consent"
        variant="link"
        onPress={confirmWithdraw}
        loading={withdraw.isPending}
        style={styles.indent}
      />
    </Card>
  );
}

/** "19 Nov 2026". */
function agreedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AccountDeleted({ onStartAgain }: AccountDeletedProps) {
  return (
    <SafeAreaView style={[styles.screen, styles.done]}>
      {/* No way back: the screens behind belong to the deleted account. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={[styles.dot, styles.dotBig]}>
        <Icon name="check" size={30} color={colors.onBrand} />
      </View>
      <Text variant="h1" accessibilityRole="header">
        Account deleted
      </Text>
      <Text variant="caption">Everything you saved is gone.</Text>
      <Button
        title="Start again"
        onPress={onStartAgain}
        style={styles.startAgain}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  content: {
    gap: 10,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  section: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xxs,
  },
  card: { gap: spacing.xxs },
  status: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOn: { backgroundColor: severityColors.green.solid },
  dotOff: { backgroundColor: colors.inkSecondary },
  dotBig: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
  },
  indent: { marginLeft: 38 },
  footer: {
    gap: 10,
    paddingHorizontal: screenGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  done: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  startAgain: { alignSelf: "stretch", marginTop: spacing.sm },
});
