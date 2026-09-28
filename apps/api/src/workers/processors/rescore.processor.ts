import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Job, UnrecoverableError } from "bullmq";
import { Model } from "mongoose";
import { VerdictCacheService } from "../../common/verdict-cache.service";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../../database/schemas/product-version.schema";
import { ScoringService } from "../../scoring/scoring.service";
import { JobQueuesService } from "../job-queues.service";
import { QUEUE_RESCORE, type RescoreJobData } from "../queue-names";

@Processor(QUEUE_RESCORE)
export class RescoreProcessor extends WorkerHost {
  private readonly logger = new Logger(RescoreProcessor.name);

  constructor(
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly scoring: ScoringService,
    private readonly queues: JobQueuesService,
    private readonly cache: VerdictCacheService
  ) {
    super();
  }

  async process(job: Job<RescoreJobData>): Promise<void> {
    const version = await this.versions
      .findById(job.data.productVersionId)
      .exec();
    if (!version) {
      throw new UnrecoverableError(
        `Product version ${job.data.productVersionId} not found`
      );
    }
    await this.scoring.ensureScoringRecord(version);
    // The stored scoring_record may be unchanged (same rule_set_version),
    // but this job exists specifically because upstream data did change
    // (e.g. alias resolution improved) — drop any cached verdict so the
    // next lookup recomputes rather than serving what was cached before.
    await this.cache.invalidateVersion(
      version.barcode,
      job.data.productVersionId
    );
  }

  @OnWorkerEvent("failed")
  async onFailed(
    job: Job<RescoreJobData> | undefined,
    error: Error
  ): Promise<void> {
    if (!job) {
      return;
    }
    this.logger.error(
      `rescore job ${job.id} failed: ${error.message}`,
      error.stack
    );
    await this.queues.moveToDeadLetterIfExhausted({
      sourceQueue: QUEUE_RESCORE,
      jobName: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      attempts: job.opts.attempts,
      failedReason: error.message,
      unrecoverable: error instanceof UnrecoverableError,
    });
  }
}
