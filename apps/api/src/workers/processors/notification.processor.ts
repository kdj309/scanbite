import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PushNotifier } from "../../push/push-notifier";
import { JobQueuesService } from "../job-queues.service";
import {
  JOB_CHECK_PUSH_RECEIPTS,
  QUEUE_NOTIFICATION,
  type CheckPushReceiptsJobData,
  type NotifyJobData,
} from "../queue-names";

@Processor(QUEUE_NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notifier: PushNotifier,
    private readonly queues: JobQueuesService
  ) {
    super();
  }

  async process(
    job: Job<NotifyJobData | CheckPushReceiptsJobData>
  ): Promise<void> {
    if (job.name === JOB_CHECK_PUSH_RECEIPTS) {
      await this.notifier.checkReceipts(job.data as CheckPushReceiptsJobData);
    } else {
      await this.notifier.notifySubmission(job.data as NotifyJobData);
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<NotifyJobData | CheckPushReceiptsJobData> | undefined,
    error: Error
  ): Promise<void> {
    if (!job) {
      return;
    }
    this.logger.error(
      `notification job ${job.id} failed: ${error.message}`,
      error.stack
    );
    await this.queues.moveToDeadLetterIfExhausted({
      sourceQueue: QUEUE_NOTIFICATION,
      jobName: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      attempts: job.opts.attempts,
      failedReason: error.message,
    });
  }
}
