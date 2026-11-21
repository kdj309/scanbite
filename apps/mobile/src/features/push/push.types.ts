/** The data on a submission notification (API: push/push-notifier.ts). */
export interface PushData {
  event?: "ready" | "needs_review" | "failed";
  submission_id?: string;
  /** "" for a label check (no barcode). */
  barcode?: string;
  label_check_id?: string;
}
