import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Avatar } from "@/components";
import { useHousehold } from "@/features/household/api";
import { useOnboardingDraft } from "@/features/onboarding/draft";
import { addedPeople, WHO_OPTIONS } from "@/features/onboarding/model";
import { PersonTile } from "@/features/onboarding/person-tile";
import { useFinishSetup } from "@/features/onboarding/setup-seen";
import { StepScreen } from "@/features/onboarding/step-screen";
import { relationshipTints } from "@/theme";

/** Pick one person to set up; come back here to add the next, or finish. */
export default function Who() {
  const { start } = useOnboardingDraft();
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
      <View style={styles.grid}>
        {WHO_OPTIONS.map((option) => {
          const tint = relationshipTints[option.relationship];
          const avatar = (
            <Avatar
              initials={option.initials}
              icon={option.icon}
              size={46}
              background={tint.background}
              color={tint.text}
            />
          );
          // One tile is one person; more come later from the Family screen.
          const [person] = added.get(option.relationship) ?? [];
          if (person) {
            const self = option.relationship === "self";
            return (
              <PersonTile
                key={option.relationship}
                title={option.title}
                subtitle={self ? option.subtitle : person.name}
                leading={avatar}
                edit={{
                  label: self ? "Edit your profile" : `Edit ${person.name}`,
                  onPress: () =>
                    router.push({
                      pathname: "/family/[id]",
                      params: { id: person.id },
                    }),
                }}
                style={styles.tile}
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
                router.push("/onboarding/about");
              }}
              style={styles.tile}
            />
          );
        })}
      </View>
    </StepScreen>
  );
}

/** Bitey names who's in so far (design 0a), or explains the step. */
function whoSay(added: ReturnType<typeof addedPeople>): string {
  const names = [...added.values()].flat().map((person) => person.name);
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

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // Two per row: half the width minus half the gap.
  tile: { width: "48.5%" },
});
