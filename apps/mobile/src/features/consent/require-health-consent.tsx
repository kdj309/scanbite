import { Redirect, usePathname } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Text } from "@/components";
import { spacing } from "@/theme";
import { hasHealthConsent, useMe } from "./api";
import type { RequireHealthConsentProps } from "./consent.types";

/**
 * Wraps a screen where health info is entered (family setup, adding or
 * editing a person): asks for consent first (design 0b), then comes back
 * here. The API refuses health info without it too.
 */
export function RequireHealthConsent({
  children,
  setup = false,
}: RequireHealthConsentProps) {
  const me = useMe();
  const pathname = usePathname();

  if (me.data === undefined) {
    if (!me.isError) return <ActivityIndicator style={styles.center} />;
    return (
      <View style={styles.center}>
        <Text>Can’t load your account right now.</Text>
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => void me.refetch()}
        />
      </View>
    );
  }
  if (!hasHealthConsent(me.data)) {
    return (
      <Redirect
        href={{
          pathname: "/consent",
          params: setup ? { next: pathname, setup: "1" } : { next: pathname },
        }}
      />
    );
  }
  return children;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
});
