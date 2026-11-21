import { router } from "expo-router";
import { View } from "react-native";
import { usePersonDraft } from "@/features/add-person/draft";
import { ADD_FLOW } from "@/features/add-person/flows";
import { addOptions } from "@/features/add-person/model";
import { OptionAvatar } from "@/features/add-person/option-avatar";
import { PersonTile, tileGrid } from "@/features/add-person/person-tile";
import { StepScreen } from "@/features/add-person/step-screen";
import { useHousehold } from "@/features/household/api";

/** Family → "Add family member": pick who, then the same steps as setup. */
export default function AddMember() {
  const { start } = usePersonDraft();
  const household = useHousehold();
  const options = addOptions(household.data?.members ?? []);

  return (
    <StepScreen
      step={1}
      say="Who's joining your family? I'll check every scan for them too."
      title="Who are you adding?"
    >
      <View style={tileGrid.grid}>
        {options.map((option) => (
          <PersonTile
            key={option.relationship}
            title={option.title}
            subtitle={option.subtitle}
            leading={<OptionAvatar option={option} />}
            onPress={() => {
              start(option.relationship);
              router.push(ADD_FLOW.about);
            }}
            style={tileGrid.tile}
          />
        ))}
      </View>
    </StepScreen>
  );
}
