import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  deadLetterPayload,
  shouldMoveToDeadLetter,
  type DeadLetterPayload,
} from "./dead-letter";
import {
  JOB_DEAD_LETTER,
  JOB_EXTRACT,
  JOB_NOTIFY,
  JOB_PROMOTE,
  JOB_RESCORE,
  QUEUE_DLQ,
  QUEUE_EXTRACTION,
  QUEUE_NOTIFICATION,
  QUEUE_PROMOTE,
  QUEUE_RESCORE,
  type ExtractJobData,
  type NotifyJobData,
  type PromoteJobData,
  type RescoreJobData,
} from "./queue-names";

const EXTRACT_JOB_OPTS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
};

@Injectable()
export class JobQueuesService {
  constructor(
    @InjectQueue(QUEUE_EXTRACTION) private readonly extraction: Queue,
    @InjectQueue(QUEUE_NOTIFICATION) private readonly notification: Queue,
    @InjectQueue(QUEUE_PROMOTE) private readonly promote: Queue,
    @InjectQueue(QUEUE_RESCORE) private readonly rescore: Queue,
    @InjectQueue(QUEUE_DLQ) private readonly dlq: Queue
  ) {}

  /**
   * BullMQ silently no-ops `add()` when a job with the given jobId already
   * exists in Redis — even in a terminal "failed" state. The returned Job
   * object misleadingly reflects the new data passed in, but nothing is
   * actually written; the stale job just sits there forever. Any queue
   * using a deterministic jobId (to dedupe in-flight work) must clear a
   * finished job first, or a single failure permanently blocks all future
   * retries for that same id.
   *
   * @returns true if it's safe to add (no job existed, or a finished one
   * was just removed); false if a job is already in flight and should be
   * left alone.
   */
  private async clearFinishedJob(
    queue: Queue,
    jobId: string
  ): Promise<boolean> {
    const existing = await queue.getJob(jobId);
    if (!existing) {
      return true;
    }
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.remove();
      return true;
    }
    return false;
  }

  async enqueueExtraction(submissionId: string): Promise<void> {
    const jobId = `${JOB_EXTRACT}:${submissionId}`;
    if (!(await this.clearFinishedJob(this.extraction, jobId))) {
      return;
    }
    await this.extraction.add(
      JOB_EXTRACT,
      { submissionId } satisfies ExtractJobData,
      { jobId, ...EXTRACT_JOB_OPTS }
    );
  }

  async enqueuePromote(data: PromoteJobData): Promise<void> {
    const jobId = `${JOB_PROMOTE}:${data.submissionId}:${data.productVersionId}`;
    if (!(await this.clearFinishedJob(this.promote, jobId))) {
      return;
    }
    await this.promote.add(JOB_PROMOTE, data, {
      jobId,
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
    });
  }

  async enqueueNotification(data: NotifyJobData): Promise<void> {
    await this.notification.add(JOB_NOTIFY, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  }

  async enqueueRescore(data: RescoreJobData): Promise<void> {
    await this.rescore.add(JOB_RESCORE, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
  }

  async enqueueDeadLetter(payload: DeadLetterPayload): Promise<void> {
    await this.dlq.add(JOB_DEAD_LETTER, payload, { attempts: 1 });
  }

  async moveToDeadLetterIfExhausted(input: {
    sourceQueue: string;
    jobName: string;
    data: unknown;
    attemptsMade: number;
    attempts: number | undefined;
    failedReason: string;
    unrecoverable?: boolean;
  }): Promise<boolean> {
    if (
      !shouldMoveToDeadLetter(
        input.attemptsMade,
        input.attempts,
        input.unrecoverable
      )
    ) {
      return false;
    }
    await this.enqueueDeadLetter(
      deadLetterPayload({
        sourceQueue: input.sourceQueue,
        jobName: input.jobName,
        data: input.data,
        failedReason: input.failedReason,
        attemptsMade: input.attemptsMade,
      })
    );
    return true;
  }
}
