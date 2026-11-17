import type {
  ProductFoundResponse,
  RuleExplainerItem,
} from "@foodscanner/shared";
import type { PersonOption, VerdictView } from "./view";

export interface MoreListProps {
  more: VerdictView["more"];
}

export interface PersonSwitcherProps {
  options: readonly PersonOption[];
  selected: string;
  onSelect: (id: string) => void;
}

export interface UnreadLabelProps {
  /** null = a label check (a pack with no barcode, design 2d). */
  barcode: string | null;
  result: ProductFoundResponse;
  scannedFor: string | undefined;
}

export interface WhySheetProps {
  explainer: RuleExplainerItem | undefined;
  /** "For Papa · Sugar": shown with the personal line, if there is one. */
  forWhom: string | undefined;
  onClose: () => void;
}
