import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import type { DeadLetterPayload } from "../dead-letter";
import { QUEUE_DLQ } from "../queue-names";

@Processor(QUEUE_DLQ)
export class DlqProcessor extends WorkerHost {
  private readonly logger = new Logger(DlqProcessor.name);

  async process(job: Job<DeadLetterPayload>): Promise<void> {
    this.logger.warn(
      `DLQ ${job.data.sourceQueue}/${job.data.jobName} attempts=${job.data.attemptsMade}: ${job.data.failedReason}`
    );
  }
}
