import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Job, UnrecoverableError } from "bullmq";
import { Model } from "mongoose";
import { ConsensusService } from "../../consensus/consensus.service";
import {
  Submission,
  SubmissionDocument,
} from "../../database/schemas/submission.schema";
import { applyPromoteResult } from "../extraction.pipeline";
import { JobQueuesService } from "../job-queues.service";
import { QUEUE_PROMOTE, type PromoteJobData } from "../queue-names";

@Processor(QUEUE_PROMOTE)
export class PromoteProcessor extends WorkerHost {
  private readonly logger = new Logger(PromoteProcessor.name);

  constructor(
    private readonly consensus: ConsensusService,
    private readonly queues: JobQueuesService,
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>
  ) {
    super();
  }

  async process(job: Job<PromoteJobData>): Promise<void> {
    const result = await this.consensus.promoteIfEligible(
      job.data.productVersionId
    );
    await applyPromoteResult({
      submissionId: job.data.submissionId,
      result,
      submissions: this.submissions,
      queues: this.queues,
    });
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<PromoteJobData> | undefined,
    error: Error
  ): Promise<void> {
    if (!job) {
      return;
    }
    this.logger.error(
      `promote job ${job.id} failed: ${error.message}`,
      error.stack
    );
    const exhausted = await this.queues.moveToDeadLetterIfExhausted({
      sourceQueue: QUEUE_PROMOTE,
      jobName: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      attempts: job.opts.attempts,
      failedReason: error.message,
      unrecoverable: error instanceof UnrecoverableError,
    });
    if (!exhausted) {
      return;
    }
    await this.submissions
      .updateOne({ _id: job.data.submissionId }, { $set: { status: "failed" } })
      .exec();
    const submission = await this.submissions
      .findById(job.data.submissionId)
      .exec();
    if (submission) {
      await this.queues.enqueueNotification({
        userId: String(submission.user_id),
        submissionId: job.data.submissionId,
        event: "failed",
      });
    }
  }
}
