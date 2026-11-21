import { ADD_FLOW } from "@/features/add-person/flows";
import { AllergiesStep } from "@/features/add-person/steps";

export default function AddAllergies() {
  return <AllergiesStep flow={ADD_FLOW} />;
}
