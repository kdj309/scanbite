import { SETUP_FLOW } from "@/features/add-person/flows";
import { AboutStep } from "@/features/add-person/steps";

export default function SetupAbout() {
  return <AboutStep flow={SETUP_FLOW} />;
}
