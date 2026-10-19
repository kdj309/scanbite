import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bitey, Button, DotPattern, Text } from "@/components";
import { useFinishSetup } from "@/features/onboarding/setup-seen";
import { colors, shadows, spacing } from "@/theme";

/** Welcome: Bitey introduces itself, then set up the family or skip. */
export default function Welcome() {
  const finishSetup = useFinishSetup();

  return (
    <View style={styles.screen}>
      <DotPattern />
      <SafeAreaView style={styles.safe}>
        <View style={styles.disc}>
          <Bitey size={140} />
        </View>
        <View style={styles.copy}>
          <Text variant="display" color="onBrand" style={styles.title}>
            Hi, I’m Bitey!
          </Text>
          <Text variant="bodyStrong" color="onBrand" style={styles.centered}>
            I read food labels so you don’t have to — and I check them for
            everyone you shop for.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            title="Let’s set up my family"
            variant="mango"
            onPress={() => router.push("/onboarding/who")}
          />
          <Button
            title="I’ll just scan for now"
            variant="link"
            onPress={() => void finishSetup("/")}
            style={styles.skip}
            textColor="onBrand"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand },
  safe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    padding: 30,
  },
  disc: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadows.raised,
  },
  copy: { gap: 10 },
  title: { fontSize: 32, lineHeight: 38, textAlign: "center" },
  centered: { textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 10, marginTop: spacing.lg },
  skip: { alignSelf: "center" },
});
