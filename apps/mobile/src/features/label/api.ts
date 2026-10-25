import {
  createSubmissionResponseSchema,
  submissionStatusResponseSchema,
} from "@foodscanner/shared";
import { useQuery } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { api } from "@/api/client";

/** Sends the label photos (or video frames) for a product we don't know. */
export function uploadLabel(barcode: string, photoUris: readonly string[]) {
  const body = new FormData();
  for (const uri of photoUris) {
    // Expo's fetch reads a file's bytes from a File (not { uri, name, type });
    // name and type come from the saved .jpg.
    body.append("photos", new File(uri));
  }
  return api(
    `/products/${barcode}/submissions`,
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
