import type {
  HouseholdMember,
  NutrientKey,
  ProductFoundResponse,
  Severity,
  Verdict,
} from "@foodscanner/shared";

/** A flag's colour: a nutrient is marked in the tone of the flag that read it. */
export type FlagTone = Exclude<Severity, "green">;

/** Each nutrient a flag read, in the worst tone that flagged it. */
export type FlaggedNutrients = ReadonlyMap<string, FlagTone>;

/** The person the screen explains, their verdict, and what it flagged. */
export interface DecidedFor {
  person: HouseholdMember | undefined;
  verdict: Verdict | undefined;
  flagged: FlaggedNutrients;
}

/** How a nutrient is named in the nutrition table. */
export interface NutrientLabel {
  name: string;
  /** Shown indented under the one before (sugar under carbohydrate). */
  sub?: boolean;
}

/** One of the four key-number tiles. */
export interface TileSpec {
  key: NutrientKey;
  name: string;
  /** Energy shows its number alone: "kcal" doesn't fit a quarter-width tile. */
  unitShown: boolean;
}

export interface NutritionRow {
  name: string;
  value: string;
  sub: boolean;
  /** Set when a flag read this nutrient. */
  tone?: FlagTone;
}

export interface Tile {
  name: string;
  value: string;
  tone?: FlagTone;
}

/** Route params for /how-we-decided: a product or a label check, and who. */
export type DecidedParams = {
  barcode?: string;
  check?: string;
  member?: string;
};

export type LabelSection = "nutrition" | "ingredients";

export interface DecidedScreenProps {
  result: ProductFoundResponse;
  members: readonly HouseholdMember[];
  /** The person picked on the verdict; absent for "All". */
  memberId: string | undefined;
}

export interface DecidedUnavailableProps {
  message: string;
  /** Offered when trying again may work (a failed load, not a missing product). */
  onRetry?: () => void;
}

export interface DecidedHeaderProps {
  productName: string;
  person: HouseholdMember | undefined;
  source: ProductFoundResponse["product"]["source"];
}

export interface ChecksCardProps {
  verdict: Verdict;
}

export interface NutrientTilesProps {
  tiles: readonly Tile[];
  basis: string;
}

export interface LabelDetailsProps {
  rows: readonly NutritionRow[];
  ingredients: readonly string[];
}

export interface CheckMarkProps {
  /** A flag's tone, "green" for a pass, absent for a gap we couldn't check. */
  tone: Severity | undefined;
}

export interface ExpandRowProps {
  title: string;
  open: boolean;
  onPress: () => void;
}
