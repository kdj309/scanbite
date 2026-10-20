import {
  listRuleExplainersResponseSchema,
  productLookupResponseSchema,
} from "@foodscanner/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

/** Every product's verdicts: they change when the family does. */
export const productsQueryKey = ["product"] as const;

export function productQueryKey(barcode: string) {
  return [...productsQueryKey, barcode] as const;
}

/** Today's verdicts for everyone (the scanner fills this in first). */
export function useProduct(barcode: string) {
  return useQuery({
    queryKey: productQueryKey(barcode),
    // Just scanned: the scan's own result is current, no need to ask again.
    staleTime: 60_000,
    queryFn: () => api(`/products/${barcode}`, productLookupResponseSchema),
  });
}

/** "Why does this matter?" for one rule, with a line for one person. */
export function useRuleExplainer(
  ruleId: string | undefined,
  memberId: string | undefined
) {
  return useQuery({
    queryKey: ["rule-explainer", ruleId, memberId],
    queryFn: async () => {
      const query = new URLSearchParams({ ids: ruleId ?? "" });
      if (memberId) {
        query.set("member_id", memberId);
      }
      const { items } = await api(
        `/rule-explainers?${query.toString()}`,
        listRuleExplainersResponseSchema
      );
      // null: this rule has no explainer (a query can't return undefined).
      return (
        items.find((item) => ruleId && item.rule_ids.includes(ruleId)) ?? null
      );
    },
    enabled: ruleId !== undefined,
    staleTime: Infinity,
  });
}
