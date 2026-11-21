import { ADD_FLOW } from "@/features/add-person/flows";
import { AboutStep } from "@/features/add-person/steps";

export default function AddAbout() {
  return <AboutStep flow={ADD_FLOW} />;
}
