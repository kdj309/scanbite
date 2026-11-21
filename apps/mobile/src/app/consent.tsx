import { useLocalSearchParams } from "expo-router";
import { ConsentScreen } from "@/features/consent/consent-screen";
import type { ConsentParams } from "@/features/consent/consent.types";

/** Health info consent (design 0b); see ConsentParams for how it's opened. */
export default function Consent() {
  const { next, mode, setup } = useLocalSearchParams<ConsentParams>();
  return (
    <ConsentScreen
      next={next ?? "/"}
      returnAfter={mode === "return"}
      fromSetup={setup === "1"}
    />
  );
}
