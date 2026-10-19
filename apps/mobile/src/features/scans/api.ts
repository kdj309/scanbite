import { listScansResponseSchema } from "@foodscanner/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

const recentScansQueryKey = ["scans", "recent"] as const;

/** The household's latest scans, newest first (Home). */
export function useRecentScans() {
  return useQuery({
    queryKey: recentScansQueryKey,
    queryFn: () => api("/scans?limit=10", listScansResponseSchema),
  });
}
