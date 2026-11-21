import { router } from "expo-router";
import { View } from "react-native";
import { useHousehold } from "@/features/household/api";
import { editLabel, openEdit } from "@/features/household/edit-link";
import { displayName, ownName } from "@/features/household/members";
import { usePersonDraft } from "@/features/add-person/draft";
import { SETUP_FLOW } from "@/features/add-person/flows";
import { addedPeople, WHO_OPTIONS } from "@/features/add-person/model";
import { OptionAvatar } from "@/features/add-person/option-avatar";
import { PersonTile, tileGrid } from "@/features/add-person/person-tile";
import { RequireHealthConsent } from "@/features/consent/require-health-consent";
import { useFinishSetup } from "@/features/onboarding/setup-seen";
import { StepScreen } from "@/features/add-person/step-screen";

/** Family setup asks for consent first (design 0b), before any health info. */
export default function WhoRoute() {
  return (
    <RequireHealthConsent setup>
      <Who />
    </RequireHealthConsent>
  );
}

/** Pick one person to set up; come back here to add the next, or finish. */
function Who() {
  const { start } = usePersonDraft();
  const household = useHousehold();
  const finishSetup = useFinishSetup();
  const added = addedPeople(household.data?.members ?? []);

  return (
    <StepScreen
      step={1}
      say={whoSay(added)}
      title="Who do you shop for?"
      nextLabel="Done"
      onNext={() => void finishSetup("/onboarding/done")}
      nextDisabled={added.size === 0}
    >
      <View style={tileGrid.grid}>
        {WHO_OPTIONS.map((option) => {
          const avatar = <OptionAvatar option={option} />;
          // One tile is one person; more come later from the Family screen.
          const [person] = added.get(option.relationship) ?? [];
          if (person) {
            return (
              <PersonTile
                key={option.relationship}
                title={option.title}
                subtitle={ownName(person) ?? option.subtitle}
                leading={avatar}
                edit={{
                  label: editLabel(person),
                  onPress: () => openEdit(person),
                }}
                style={tileGrid.tile}
              />
            );
          }
          return (
            <PersonTile
              key={option.relationship}
              title={option.title}
              subtitle={option.subtitle}
              leading={avatar}
              onPress={() => {
                start(option.relationship);
                router.push(SETUP_FLOW.about);
              }}
              style={tileGrid.tile}
            />
          );
        })}
      </View>
    </StepScreen>
  );
}

/** Bitey names who's in so far (design 0a), or explains the step. */
function whoSay(added: ReturnType<typeof addedPeople>): string {
  const names = [...added.values()].flat().map(displayName);
  if (names.length === 0) {
    return "Pick someone you buy food for. You can add more after.";
  }
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const verb = names.length === 1 && names[0] !== "You" ? "is" : "are";
  return `${list} ${verb} added. Anyone else?`;
}
