import { SETUP_FLOW } from "@/features/add-person/flows";
import { ConditionsStep } from "@/features/add-person/steps";

export default function SetupConditions() {
  return <ConditionsStep flow={SETUP_FLOW} />;
}
