import { SETUP_FLOW } from "@/features/add-person/flows";
import { AllergiesStep } from "@/features/add-person/steps";

export default function SetupAllergies() {
  return <AllergiesStep flow={SETUP_FLOW} />;
}
