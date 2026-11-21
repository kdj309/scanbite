import {
  createScanResponseSchema,
  listScansResponseSchema,
  type CreateScanRequest,
  type CreateScanResponse,
} from "@foodscanner/shared";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { api, NO_CONTENT } from "@/api/client";

export const recentScansQueryKey = ["scans", "recent"] as const;

/** The household's latest scans, newest first (Home). */
export function useRecentScans() {
  return useQuery({
    queryKey: recentScansQueryKey,
    queryFn: () => api("/scans?limit=10", listScansResponseSchema),
  });
}

/** Looks the product up for everyone (or one person) and adds it to Recent scans. */
export function createScan(
  body: CreateScanRequest
): Promise<CreateScanResponse> {
  return api("/scans", createScanResponseSchema, { method: "POST", body });
}

/** Removes a Recent scans row for good (the product stays in the catalogue). */
export function removeScan(id: string): Promise<void> {
  return api(`/scans/${id}`, NO_CONTENT, { method: "DELETE" });
}

/** A new scan was made: Home's list is out of date. */
export function refreshRecentScans(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: recentScansQueryKey });
}
