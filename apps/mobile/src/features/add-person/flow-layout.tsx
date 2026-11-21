import { Stack } from "expo-router";
import { useHousehold } from "@/features/household/api";
import { HouseholdLoading } from "@/features/household/household-loading";
import { colors } from "@/theme";
import { PersonDraftProvider } from "./draft";

/**
 * The layout of a flow that adds people: loads the family first (the
 * tiles show who's already added), then holds the person being added.
 */
export function PersonFlowLayout() {
  const household = useHousehold();

  // Only before the first load: a failed refresh later (after a save)
  // mustn't tear down the flow the person is in the middle of.
  if (household.data === undefined) {
    return <HouseholdLoading household={household} />;
  }
  return (
    <PersonDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </PersonDraftProvider>
  );
}
