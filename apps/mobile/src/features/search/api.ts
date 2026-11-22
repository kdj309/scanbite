import { productSearchResponseSchema } from "@foodscanner/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

/** The API searches from this many letters, up to this many (productSearchQuerySchema). */
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 60;

/** Catalogue products matching `query`, best match first (design 1e). */
export function useProductSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["product-search", q],
    queryFn: () =>
      api(
        `/products/search?q=${encodeURIComponent(q)}`,
        productSearchResponseSchema
      ),
    enabled: q.length >= MIN_QUERY_LENGTH,
    // Keep the last results on screen while the next letters load.
    placeholderData: keepPreviousData,
  });
}
