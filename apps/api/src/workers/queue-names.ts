export const QUEUE_EXTRACTION = "extraction";
export const QUEUE_NOTIFICATION = "notification";
export const QUEUE_PROMOTE = "promote";
export const QUEUE_RESCORE = "rescore";
export const QUEUE_DLQ = "dlq";

export const JOB_EXTRACT = "extract";
export const JOB_NOTIFY = "notify";
export const JOB_PROMOTE = "promote";
export const JOB_RESCORE = "rescore";
export const JOB_DEAD_LETTER = "dead-letter";

export type ExtractJobData = {
  submissionId: string;
};

export type PromoteJobData = {
  productVersionId: string;
  submissionId: string;
};

export type NotificationEvent = "ready" | "needs_review" | "failed";

export type NotifyJobData = {
  userId: string;
  submissionId: string;
  event: NotificationEvent;
};

export type RescoreJobData = {
  productVersionId: string;
};
