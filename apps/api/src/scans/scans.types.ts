import type { Types } from "mongoose";
import type { HouseholdProductVerdict } from "../personalization/household-verdict.service";

/** One scan to save: a product (by barcode) or a label check, and its verdict. */
export type ScanRecordInput = {
  userId: string;
  forMemberId: string | undefined;
  barcode: string | null;
  labelCheckId: Types.ObjectId | null;
  productVersionId: Types.ObjectId | null;
  verdict: HouseholdProductVerdict | null;
};
