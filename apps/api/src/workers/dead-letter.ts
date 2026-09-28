export function shouldMoveToDeadLetter(
  attemptsMade: number,
  attempts: number | undefined,
  unrecoverable = false
): boolean {
  return unrecoverable || attemptsMade >= (attempts ?? 1);
}

export type DeadLetterPayload = {
  sourceQueue: string;
  jobName: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
};

export function deadLetterPayload(input: {
  sourceQueue: string;
  jobName: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
}): DeadLetterPayload {
  return {
    sourceQueue: input.sourceQueue,
    jobName: input.jobName,
    data: input.data,
    failedReason: input.failedReason,
    attemptsMade: input.attemptsMade,
  };
}
