import {
  alternativesResponseSchema,
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

/** Healthier swaps for a flagged product, Safe for everyone it flagged. */
export function useBetterOptions(barcode: string) {
  return useQuery({
    queryKey: [...productQueryKey(barcode), "better-options"],
    queryFn: () =>
      api(`/products/${barcode}/alternatives`, alternativesResponseSchema),
    // Opened without a product (e.g. a stale link): nothing to look up.
    enabled: Boolean(barcode),
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
