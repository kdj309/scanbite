import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "@/components";
import {
  createMember,
  showSavedMember,
  updateMember,
  useHousehold,
} from "@/features/household/api";
import { nameMissing, selfMember } from "@/features/household/members";
import {
  AgePicker,
  AllergiesPicker,
  ConditionsPicker,
  NameField,
} from "@/features/household/profile-pickers";
import { usePersonDraft } from "./draft";
import type { PersonFlow } from "./flows";
import {
  consentBasis,
  hasPermission,
  permissionText,
  saveRequest,
  stepCopy,
  type DraftPerson,
} from "./model";
import { PermissionTick } from "./permission-tick";
import { StepScreen } from "./step-screen";

type StepProps = { flow: PersonFlow };

/** Step 2: what to call them, and roughly how old they are. */
export function AboutStep({ flow }: StepProps) {
  const { person, update } = usePersonDraft();
  if (!person) {
    // The draft lives in memory; after a reload, pick the person again.
    return <Redirect href={flow.start} />;
  }
  const copy = stepCopy(person);

  return (
    <StepScreen
      step={2}
      say={copy.aboutSay}
      title={copy.aboutTitle}
      nextLabel="Continue"
      // Age is optional ("a ballpark is fine").
      nextDisabled={nameMissing(person.relationship, person.name)}
      onNext={() => router.push(flow.conditions)}
    >
      <NameField
        relationship={person.relationship}
        value={person.name}
        onChange={(name) => update({ name })}
      />
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

/**
 * Step 3: their conditions. For anyone but you, a tick first confirms you
 * may add their details (design 8c), even with nothing picked.
 */
export function ConditionsStep({ flow }: StepProps) {
  const { person, update } = usePersonDraft();
  const [asked, setAsked] = useState(false);
  if (!person) {
    return <Redirect href={flow.start} />;
  }
  const copy = stepCopy(person);
  const count = person.conditions.length;
  const needsPermission = person.relationship !== "self";
  const onNext = () => {
    if (needsPermission && !hasPermission(person)) {
      setAsked(true);
      return;
    }
    router.push(flow.allergies);
  };

  return (
    <StepScreen
      step={3}
      say={copy.conditionsSay}
      title={copy.conditionsTitle}
      nextLabel="Continue"
      onNext={onNext}
    >
      <Text variant="caption" style={styles.count}>
        {count === 0 ? "None selected" : `${count} selected`}
      </Text>
      <ConditionsPicker
        value={person.conditions}
        onChange={(conditions) => update({ conditions })}
      />
      {needsPermission && (
        <PermissionTick
          label={permissionText(person)}
          checked={hasPermission(person)}
          onToggle={() =>
            update({
              permissionFor: hasPermission(person)
                ? null
                : consentBasis(person),
            })
          }
          asked={asked}
        />
      )}
    </StepScreen>
  );
}

/** Step 4: their allergies; Save adds them, then returns to `flow.saved`. */
export function AllergiesStep({ flow }: StepProps) {
  const { person, update } = usePersonDraft();
  const household = useHousehold();
  const queryClient = useQueryClient();

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
    onSuccess: (saved) => {
      showSavedMember(queryClient, saved);
      router.dismissTo(flow.saved);
    },
  });

  if (!person) {
    return <Redirect href={flow.start} />;
  }
  const copy = stepCopy(person);

  return (
    <StepScreen
      step={4}
      say={copy.allergiesSay}
      title={copy.allergiesTitle}
      nextLabel="Save"
      onNext={() => save.mutate(person)}
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
          disabled={save.isPending}
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

const styles = StyleSheet.create({
  age: { gap: 10, marginTop: 8 },
  centered: { textAlign: "center" },
  count: { alignSelf: "flex-end" },
});
