import { Injectable, Logger } from "@nestjs/common";

/** Stub extraction enqueue — BullMQ processors land in the workers todo. */
@Injectable()
export class ExtractionQueueService {
  private readonly logger = new Logger(ExtractionQueueService.name);

  async enqueueExtraction(submissionId: string): Promise<void> {
    this.logger.log(`stub enqueue extraction job for submission ${submissionId}`);
  }
}
