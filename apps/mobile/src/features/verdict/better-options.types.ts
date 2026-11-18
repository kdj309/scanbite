import type {
  Alternative,
  AlternativesResponse,
  CautionAlternative,
  Improvement,
  ProductSummary,
  Severity,
} from "@foodscanner/shared";

/** Route params for /better-options. */
export type BetterOptionsParams = {
  barcode: string;
};

export interface BetterOptionsScreenProps {
  barcode: string;
}

export interface BetterOptionsListProps {
  options: AlternativesResponse;
  /** The scanned product's overall verdict, once it has loaded. */
  severity: Severity | undefined;
}

export interface InsteadOfProps {
  product: ProductSummary;
  /** The scanned product's overall verdict, once it has loaded. */
  severity: Severity | undefined;
}

export interface OptionCardProps {
  alternative: Alternative;
  /** The first option, shown as the top pick. */
  top: boolean;
}

export interface CautionCardProps {
  alternative: CautionAlternative;
}

export interface ImprovementChipsProps {
  improvements: readonly Improvement[];
}

export interface ThumbProps {
  product: ProductSummary;
  size: number;
  tint?: string;
}
