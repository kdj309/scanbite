import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ProductFoundResponse } from "@foodscanner/shared";
import { Model } from "mongoose";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import {
  Submission,
  SubmissionDocument,
} from "../database/schemas/submission.schema";
import { DevicesService } from "../devices/devices.service";
import { HouseholdVerdictService } from "../personalization/household-verdict.service";
import { JobQueuesService } from "../workers/job-queues.service";
import type {
  CheckPushReceiptsJobData,
  NotifyJobData,
} from "../workers/queue-names";
import { classifyPushResults, type PushOutcome } from "./push-results";
import { PushSender } from "./push-sender";
import { submissionMessage } from "./submission-message";

/** Runs the notification queue's jobs: send, then check receipts later. */
@Injectable()
export class PushNotifier {
  private readonly logger = new Logger(PushNotifier.name);

  constructor(
    @InjectModel(Submission.name)
    private readonly submissions: Model<SubmissionDocument>,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly devices: DevicesService,
    private readonly householdVerdicts: HouseholdVerdictService,
    private readonly sender: PushSender,
    private readonly queues: JobQueuesService
  ) {}

  /**
   * One request for all the user's phones, so a retry (the queue's backoff,
   * when the whole send fails) can't double-notify a phone that got it.
   */
  async notifySubmission(job: NotifyJobData): Promise<void> {
    const tokens = await this.devices.tokensFor(job.userId);
    if (tokens.length === 0) {
      return;
    }
    const submission = await this.submissions.findById(job.submissionId).exec();
    const message = submissionMessage(
      job.event,
      job.event === "ready"
        ? await this.liveResult(submission, job.userId)
        : null
    );
    const data = {
      event: job.event,
      submission_id: job.submissionId,
      barcode: submission?.barcode ?? "",
    };

    const results = await this.sender.send(
      tokens.map((to) => ({ to, ...message, data }))
    );
    const outcome = classifyPushResults(
      results.map((result, i) => ({ token: tokens[i], result }))
    );
    await this.act(outcome);

    if (outcome.rateLimited.length === tokens.length) {
      // Nothing got through, so a retry can't duplicate — let the queue back off.
      throw new Error("Expo rate-limited every device for this user");
    }
    if (outcome.sent.length) {
      await this.queues.enqueuePushReceiptCheck({ tickets: outcome.sent });
    }
  }

  /** ~15 min later: did the phones actually get it? Drops dead tokens. */
  async checkReceipts(job: CheckPushReceiptsJobData): Promise<void> {
    const receipts = await this.sender.receipts(
      job.tickets.map((ticket) => ticket.id)
    );
    await this.act(
      classifyPushResults(
        job.tickets
          .filter((ticket) => receipts[ticket.id])
          .map((ticket) => ({
            token: ticket.token,
            result: receipts[ticket.id],
          }))
      )
    );
  }

  private async act(outcome: PushOutcome): Promise<void> {
    await this.devices.forget(outcome.deadTokens);
    for (const problem of outcome.setupErrors) {
      // Credentials/config, not the phone: fix the setup, keep the tokens.
      this.logger.error(`push setup problem — ${problem}`);
    }
  }

  private async liveResult(
    submission: SubmissionDocument | null,
    userId: string
  ): Promise<ProductFoundResponse | null> {
    const version = submission
      ? await this.versions
          .findOne({ barcode: submission.barcode, status: "live" })
          .exec()
      : null;
    return version
      ? (await this.householdVerdicts.forVersion(version, userId)).response
      : null;
  }
}
