import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet } from "react-native";
import { useHousehold } from "@/features/household/api";
import { HouseholdLoading } from "@/features/household/household-loading";
import { useLabelCheck } from "@/features/label/api";
import { useProduct } from "@/features/verdict/api";
import {
  DecidedScreen,
  DecidedUnavailable,
} from "@/features/verdict/decided-screen";
import type { DecidedParams } from "@/features/verdict/decided.types";

/**
 * How we decided (design 12a), opened from the (i) on a verdict: a
 * catalogue product by `barcode`, or a one-off label check by `check`.
 */
export default function HowWeDecided() {
  const { barcode, check, member } = useLocalSearchParams<DecidedParams>();
  // The verdict screen loaded one of these already: no new request.
  const product = useProduct(barcode ?? "");
  const labelCheck = useLabelCheck(check ?? "");
  const household = useHousehold();
  const query = check ? labelCheck : product;
  // A barcode lookup can answer "not found"; a label check always has one.
  const found = product.data?.found ? product.data : undefined;
  const result = check ? labelCheck.data : found;

  if (household.data === undefined) {
    return <HouseholdLoading household={household} />;
  }
  // What's cached shows even if a background refetch failed.
  if (result !== undefined) {
    return (
      <DecidedScreen
        result={result}
        members={household.data.members}
        memberId={member}
      />
    );
  }
  if (query.isError) {
    return (
      <DecidedUnavailable
        message="Can’t load this right now."
        onRetry={() => void query.refetch()}
      />
    );
  }
  // isLoading, not isPending: with no barcode or check the query never
  // runs, and that should read as unknown rather than spin.
  if (query.isLoading) {
    return <ActivityIndicator style={styles.fill} />;
  }
  return <DecidedUnavailable message="We don’t know this product yet." />;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
