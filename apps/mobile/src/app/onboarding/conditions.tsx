import { Redirect, router } from "expo-router";
import { StyleSheet } from "react-native";
import { Text } from "@/components";
import { ConditionsPicker } from "@/features/household/profile-pickers";
import { stepCopy } from "@/features/onboarding/model";
import { StepScreen } from "@/features/onboarding/step-screen";
import { useOnboardingDraft } from "@/features/onboarding/draft";

export default function Conditions() {
  const { person, update } = useOnboardingDraft();
  if (!person) {
    // The draft lives in memory; after a reload, pick the person again.
    return <Redirect href="/onboarding/who" />;
  }
  const copy = stepCopy(person);
  const count = person.conditions.length;

  return (
    <StepScreen
      step={3}
      say={copy.conditionsSay}
      title={copy.conditionsTitle}
      nextLabel="Continue"
      onNext={() => router.push("/onboarding/allergies")}
    >
      <Text variant="caption" style={styles.count}>
        {count === 0 ? "None selected" : `${count} selected`}
      </Text>
      <ConditionsPicker
        value={person.conditions}
        onChange={(conditions) => update({ conditions })}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  count: { alignSelf: "flex-end" },
});
