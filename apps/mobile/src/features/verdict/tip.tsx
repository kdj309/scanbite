import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Pressable, StyleSheet, View } from "react-native";
import { Bitey, Text } from "@/components";
import { colors, minTouchTarget, radii, spacing } from "@/theme";

const KEY = "scanbite.verdict-tip-seen";
const queryKey = ["verdict-tip-seen"] as const;

/** Bitey's one-time "I'm not a doctor" note on the first verdict (design S2). */
export function DisclaimerTip() {
  const queryClient = useQueryClient();
  const seen = useQuery({
    queryKey,
    queryFn: async () => (await SecureStore.getItemAsync(KEY)) === "true",
    staleTime: Infinity,
  });
  if (seen.data !== false) {
    return null;
  }
  return (
    <View style={styles.tip}>
      <Bitey size={34} />
      <Text variant="label" style={styles.text}>
        I use FSSAI food limits and your family’s conditions. I’m not a doctor.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          queryClient.setQueryData(queryKey, true);
          void SecureStore.setItemAsync(KEY, "true");
        }}
        style={styles.gotIt}
      >
        <Text variant="label" color="onBrand">
          Got it
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.mangoTint,
  },
  text: { flex: 1 },
  gotIt: {
    minHeight: minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
});
