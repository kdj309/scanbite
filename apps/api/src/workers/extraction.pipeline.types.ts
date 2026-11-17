import type { Model, Types } from "mongoose";
import type { PromoteResult } from "../consensus/consensus.service";
import type {
  SubmissionDocument,
  SubmissionStatus,
} from "../database/schemas/submission.schema";
import type { JobQueuesService } from "./job-queues.service";
import type { NotificationEvent } from "./queue-names";

export type SubmissionOutcome = {
  status: Exclude<SubmissionStatus, "processing">;
  productVersionId?: Types.ObjectId;
  event: NotificationEvent;
};

export type ApplyPromoteResultInput = {
  submissionId: string;
  result: PromoteResult;
  submissions: Model<SubmissionDocument>;
  queues: JobQueuesService;
};
