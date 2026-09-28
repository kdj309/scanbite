import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { JobQueuesService } from "../job-queues.service";
import { NoopNotifier } from "../noop-notifier";
import { QUEUE_NOTIFICATION, type NotifyJobData } from "../queue-names";

@Processor(QUEUE_NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notifier: NoopNotifier,
    private readonly queues: JobQueuesService
  ) {
    super();
  }

  async process(job: Job<NotifyJobData>): Promise<void> {
    this.notifier.notify(job.data);
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<NotifyJobData> | undefined,
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
