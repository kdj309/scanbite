import type { DeadLetterPayload } from "./dead-letter";

/** A failed job, with how many tries it gets and whether it can't succeed. */
export type FailedJob = DeadLetterPayload & {
  attempts: number | undefined;
  unrecoverable?: boolean;
};
