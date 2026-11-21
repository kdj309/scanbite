import { PersonFlowLayout } from "@/features/add-person/flow-layout";
import { RequireHealthConsent } from "@/features/consent/require-health-consent";

/** Family → "Add family member": consent first (design 0b), then the flow. */
export default function AddMemberLayout() {
  return (
    <RequireHealthConsent>
      <PersonFlowLayout />
    </RequireHealthConsent>
  );
}
