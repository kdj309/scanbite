import type { EvaluationResult, PassedRule } from "../scoring/evaluate-rules";
import type { MemberOverlay } from "./member-overlay";

export type WhatWeCheckedInput = {
  basePassed: PassedRule[];
  base: Pick<EvaluationResult, "breakdown">;
  ruleLabels: Record<string, string>;
  overlay: Pick<MemberOverlay, "checked" | "flaggedTopics">;
};
