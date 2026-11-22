import type { ProductSearchItem } from "@foodscanner/shared";

export interface SearchRowProps {
  item: ProductSearchItem;
}

export interface ResultsProps {
  items: ProductSearchItem[];
  loading: boolean;
  /** The error's message, or null. */
  error: string | null;
  onRetry: () => void;
}
