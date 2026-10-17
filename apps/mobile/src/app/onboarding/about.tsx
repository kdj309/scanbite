import { Redirect, router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Text, TextField } from "@/components";
import { AgePicker } from "@/features/household/profile-pickers";
import { stepCopy } from "@/features/onboarding/model";
import { StepScreen } from "@/features/onboarding/step-screen";
import { useOnboardingDraft } from "@/features/onboarding/draft";

const NAME_PLACEHOLDERS = {
  spouse: "e.g. Priya",
  parent: "e.g. Papa",
  child: "e.g. Riya",
  other: "e.g. Dadi",
} as const;

export default function About() {
  const { person, update } = useOnboardingDraft();
  if (!person) {
    // The draft lives in memory; after a reload, pick the person again.
    return <Redirect href="/onboarding/who" />;
  }
  const copy = stepCopy(person);
  const self = person.relationship === "self";

  return (
    <StepScreen
      step={2}
      say={copy.aboutSay}
      title={copy.aboutTitle}
      nextLabel="Continue"
      // Age is optional ("a ballpark is fine"); a name isn't, except for you.
      nextDisabled={!self && person.name.trim() === ""}
      onNext={() => router.push("/onboarding/conditions")}
    >
      {person.relationship !== "self" && (
        <TextField
          label="What do you call them?"
          placeholder={NAME_PLACEHOLDERS[person.relationship]}
          value={person.name}
          onChangeText={(name) => update({ name })}
          autoCapitalize="words"
          autoComplete="off"
          returnKeyType="done"
          maxLength={40}
        />
      )}
      <View style={styles.age}>
        {/* Screen readers get "Age in years" from the group instead. */}
        <Text
          variant="title"
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          Age
        </Text>
        <AgePicker
          value={person.ageBand}
          onChange={(ageBand) => update({ ageBand })}
        />
        <Text
          variant="caption"
          style={styles.centered}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          years
        </Text>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  age: { gap: 10, marginTop: 8 },
  centered: { textAlign: "center" },
});
