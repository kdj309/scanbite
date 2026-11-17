import type {
  HouseholdMemberInput,
  ProductContext,
} from "../personalization/household-verdict";
import type { RuleFacts } from "./rank-alternatives";

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
};
