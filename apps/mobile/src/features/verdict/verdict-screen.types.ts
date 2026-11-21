import type {
  BuyLink,
  DeclaredVeg,
  HouseholdMember,
  ProductFoundResponse,
} from "@foodscanner/shared";
import type { VerdictView } from "./view";

export interface VerdictProps {
  result: ProductFoundResponse;
  members: readonly HouseholdMember[];
  scannedFor: string | undefined;
  /** A catalogue product's: what "See better options" looks up. */
  barcode?: string;
}

export interface HeroProps {
  view: VerdictView;
  result: ProductFoundResponse;
  person: HouseholdMember | undefined;
  topInset: number;
  /** How we decided for this product; the general page without one. */
  onInfo: (() => void) | undefined;
}

export interface ReasonCardProps {
  view: VerdictView;
  hasWhy: boolean;
  onWhy: () => void;
}

export interface VegMarkProps {
  veg: DeclaredVeg;
}

export interface ActionsProps {
  view: VerdictView;
  person: HouseholdMember | undefined;
  buyLinks: readonly BuyLink[];
  barcode: string | undefined;
}
