import { ADD_FLOW } from "@/features/add-person/flows";
import { ConditionsStep } from "@/features/add-person/steps";

export default function AddConditions() {
  return <ConditionsStep flow={ADD_FLOW} />;
}
