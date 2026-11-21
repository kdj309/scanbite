import type { ScoringRecordDocument } from "../database/schemas/scoring-record.schema";
import type { EvaluationResult } from "./evaluate-rules";
import type { VersionConfidence } from "./facts.types";

/** A version's score, with the facts and rule set it was scored on. */
export type ScoredVersion = VersionConfidence & {
  facts: Record<string, unknown>;
  record: ScoringRecordDocument;
  evaluation: EvaluationResult;
  ruleSetVersion: string;
};
