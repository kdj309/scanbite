import {
  createSubmissionResponseSchema,
  labelCheckResponseSchema,
  submissionStatusResponseSchema,
} from "@foodscanner/shared";
import { useQuery } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { api } from "@/api/client";

/**
 * Sends the label photos (or video frames) for a product we don't know,
 * or, with no barcode, for a label check: a pack read for this person only.
 */
export function uploadLabel(
  barcode: string | null,
  photoUris: readonly string[],
  /** A label check's "Scan for" person; omitted = everyone. */
  memberId?: string
) {
  const body = new FormData();
  for (const uri of photoUris) {
    // Expo's fetch reads a file's bytes from a File (not { uri, name, type });
    // name and type come from the saved .jpg.
    body.append("photos", new File(uri));
  }
  return api(
    barcode !== null
      ? `/products/${barcode}/submissions`
      : memberId
        ? `/label-checks?member_id=${memberId}`
        : "/label-checks",
    createSubmissionResponseSchema,
    { method: "POST", body }
  );
}

/** Reading the label takes about a minute: ask every few seconds until done. */
export function useSubmission(submissionId: string) {
  return useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () =>
      api(`/submissions/${submissionId}`, submissionStatusResponseSchema),
    refetchInterval: (query) =>
      query.state.data === undefined || query.state.data.status === "processing"
        ? 3000
        : false,
  });
}

export function labelCheckQueryKey(id: string) {
  return ["label-check", id] as const;
}

/** A label check's verdicts for the family (design 2d). */
export function useLabelCheck(id: string) {
  return useQuery({
    queryKey: labelCheckQueryKey(id),
    // Just read: the scan's own result is current, no need to ask again.
    staleTime: 60_000,
    queryFn: () => api(`/label-checks/${id}`, labelCheckResponseSchema),
  });
}
