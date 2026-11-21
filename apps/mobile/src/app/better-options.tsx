import { useLocalSearchParams } from "expo-router";
import type { BetterOptionsParams } from "@/features/verdict/better-options.types";
import { BetterOptionsScreen } from "@/features/verdict/better-options-screen";

/** Healthier swaps for a flagged product (design S4, 4a). */
export default function BetterOptions() {
  const { barcode } = useLocalSearchParams<BetterOptionsParams>();
  return <BetterOptionsScreen barcode={barcode} />;
}
