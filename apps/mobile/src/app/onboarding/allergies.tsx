import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { Button, Text } from "@/components";
import {
  createMember,
  householdQueryKey,
  updateMember,
  useHousehold,
} from "@/features/household/api";
import { selfMember } from "@/features/household/members";
import { AllergiesPicker } from "@/features/household/profile-pickers";
import {
  saveRequest,
  stepCopy,
  type DraftPerson,
} from "@/features/onboarding/model";
import { StepScreen } from "@/features/onboarding/step-screen";
import { useOnboardingDraft } from "@/features/onboarding/draft";

export default function Allergies() {
  const { person, update } = useOnboardingDraft();
  const household = useHousehold();
  const queryClient = useQueryClient();

  // Saved as soon as their last step is done; then back to "Who do you
  // shop for?" for the next person.
  const save = useMutation({
    mutationFn: async (draft: DraftPerson) => {
      const self = selfMember(household.data?.members ?? []);
      if (!self) {
        throw new Error("Your profile hasn't loaded yet. Try again.");
      }
      const request = saveRequest(draft, self.id);
      return request.kind === "create"
        ? createMember(request.body)
        : updateMember(request.id, request.body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: householdQueryKey });
      router.dismissTo("/onboarding/who");
    },
  });

  if (!person) {
    return <Redirect href="/onboarding/who" />;
  }
  const copy = stepCopy(person);

  return (
    <StepScreen
      step={4}
      say={copy.allergiesSay}
      title={copy.allergiesTitle}
      nextLabel="Save"
      onNext={() => save.mutate(person)}
      nextDisabled={household.data === undefined}
      saving={save.isPending}
    >
      <AllergiesPicker
        value={person.allergies}
        onChange={(allergies) => update({ allergies })}
      />
      {person.allergies.length === 0 && (
        <Button
          variant="link"
          title="No allergies — skip"
          onPress={() => save.mutate(person)}
          disabled={save.isPending || household.data === undefined}
        />
      )}
      {save.isError && (
        <Text variant="caption" accessibilityRole="alert">
          Couldn’t save. {save.error.message}
        </Text>
      )}
    </StepScreen>
  );
}
