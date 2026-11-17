import type {
  Alternative,
  ProductSummary,
  Severity,
} from "@foodscanner/shared";

/** Route params for /better-options. */
export type BetterOptionsParams = {
  barcode: string;
};

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

export interface ThumbProps {
  product: ProductSummary;
  size: number;
  tint?: string;
}
