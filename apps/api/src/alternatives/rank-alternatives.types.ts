import type {
  HouseholdMemberInput,
  ProductContext,
} from "../personalization/household-verdict";
import type { RuleInput } from "../scoring/evaluate-rules";
import type { RankedAlternative, RuleFacts } from "./rank-alternatives";

/** The parts of a member that decide whether a product is Safe for them. */
export type AlternativeMember = Pick<
  HouseholdMemberInput,
  "conditions" | "allergies"
>;

export type AlternativeCandidate<T> = { item: T; context: ProductContext };

export type RankAlternativesInput<T> = {
  original: ProductContext;
  candidates: Array<AlternativeCandidate<T>>;
  members: AlternativeMember[];
  ruleFacts: RuleFacts;
  limit: number;
  /** Lower = more like the scanned product; ranks before improvement. */
  closenessOf?: (item: T) => number;
};

/** What one rule checks: the fact it reads and its limit, if numeric. */
export type RuleFact = Pick<RuleInput, "field" | "threshold">;

/** A Caution swap, with the chip labels it's still flagged for, worst first. */
export type RankedCautionAlternative<T> = RankedAlternative<T> & {
  stillFlagged: string[];
};

/** What a candidate ranks on: likeness first, then total improvement. */
export type RankKey = { closeness: number; score: number };

/** A candidate's remaining problems: rule ids, and chip labels worst first. */
export type RemainingIssues = {
  ruleIds: ReadonlySet<string>;
  labels: string[];
};
