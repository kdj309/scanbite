import {
  LABEL_NUTRIENTS,
  NUTRIENT_KEYS,
  type HouseholdMember,
  type NutrientKey,
  type Nutrition,
  type ProductFoundResponse,
  type ProductSummary,
  type Verdict,
} from "@foodscanner/shared";
import { ALL } from "./view";
import type {
  DecidedFor,
  DecidedParams,
  FlaggedNutrients,
  FlagTone,
  NutrientLabel,
  NutritionRow,
  Tile,
  TileSpec,
} from "./decided.types";

/** How we decided (design 12a): where the product's facts came from. */
export function sourceLine(source: ProductSummary["source"]): string {
  switch (source) {
    case "ai_photos":
      return "Read by AI from the label";
    case "label_check":
      return "Checked from your label";
    default:
      return "From Open Food Facts";
  }
}

/**
 * Names for the label's nutrients. Order and units come from the shared
 * LABEL_NUTRIENTS, the same list the API reads labels with.
 */
const NUTRIENT_LABELS: Record<NutrientKey, NutrientLabel> = {
  energy_kcal: { name: "Energy" },
  protein: { name: "Protein" },
  carbohydrate: { name: "Carbohydrate" },
  sugar: { name: "Sugar", sub: true },
  added_sugar: { name: "Added sugar", sub: true },
  total_fat: { name: "Fat" },
  saturated_fat: { name: "Saturated fat", sub: true },
  trans_fat: { name: "Trans fat", sub: true },
  cholesterol: { name: "Cholesterol" },
  sodium: { name: "Sodium" },
};

/** The four numbers shown as tiles. */
const TILES: readonly TileSpec[] = [
  { key: "sugar", name: "Sugar", unitShown: true },
  { key: "sodium", name: "Sodium", unitShown: true },
  { key: "total_fat", name: "Fat", unitShown: true },
  { key: "energy_kcal", name: "Energy", unitShown: false },
];

/** "100 g" or "100 ml", whichever the label used. */
export function basis(nutrition: Nutrition): string {
  const keys = Object.keys(nutrition);
  const perGram = keys.some((key) => key.endsWith("_per_100g"));
  const perMl = keys.some((key) => key.endsWith("_per_100ml"));
  return perMl && !perGram ? "100 ml" : "100 g";
}

/** The label's value for a nutrient, or undefined when it didn't give one. */
function readValue(
  nutrition: Nutrition,
  key: string
): number | string | undefined {
  return (
    nutrition[`${key}_per_100g`] ?? nutrition[`${key}_per_100ml`] ?? undefined
  );
}

function format(value: number | string, unit: string): string {
  return typeof value === "number" ? `${value} ${unit}` : value;
}

/**
 * The nutrients a flag read ("sodium_per_100g" → sodium), each in the tone
 * of its flag. Reasons come worst first, so the first flag on a nutrient
 * sets its tone.
 */
export function flaggedNutrients(verdict: Verdict): FlaggedNutrients {
  const flagged = new Map<string, FlagTone>();
  for (const reason of verdict.reasons) {
    if (reason.kind !== "flag" || !reason.field || reason.severity === "green")
      continue;
    const key = reason.field.replace(/_per_100(g|ml)$/, "");
    if (!flagged.has(key)) flagged.set(key, reason.severity);
  }
  return flagged;
}

/**
 * Where the verdict's (i) leads (design 12a): a catalogue product by
 * barcode or a label check by its id, for whoever is picked. With "All"
 * picked, no member is sent and the screen explains the most affected
 * person. Undefined when there's nothing to look the product up by.
 */
export function decidedParams(
  result: ProductFoundResponse,
  barcode: string | undefined,
  selected: string
): DecidedParams | undefined {
  // Left out, not undefined: the router would send "undefined" as text.
  const forWhom = selected === ALL ? {} : { member: selected };
  if (barcode) return { barcode, ...forWhom };
  if (result.product.source === "label_check") {
    return { check: result.product.product_version_id, ...forWhom };
  }
  return undefined;
}

const NOTHING_FLAGGED: FlaggedNutrients = new Map();

/**
 * Who the screen explains: the person picked on the verdict, else (for
 * "All") the one it's worst for, else the first person.
 */
export function decidedFor(
  result: ProductFoundResponse,
  members: readonly HouseholdMember[],
  memberId: string | undefined
): DecidedFor {
  const shown =
    result.members.find((m) => m.member_id === memberId) ??
    result.members.find((m) => m.member_id === result.overall.member_id) ??
    result.members[0];
  return {
    person: members.find((m) => m.id === shown?.member_id),
    verdict: shown?.verdict,
    flagged: shown ? flaggedNutrients(shown.verdict) : NOTHING_FLAGGED,
  };
}

/** Every nutrient the label gave, in label order. */
export function nutritionRows(
  nutrition: Nutrition,
  flagged: FlaggedNutrients
): NutritionRow[] {
  const rows: NutritionRow[] = [];
  for (const key of NUTRIENT_KEYS) {
    const value = readValue(nutrition, key);
    if (value === undefined) continue;
    const { name, sub } = NUTRIENT_LABELS[key];
    rows.push({
      name,
      value: format(value, LABEL_NUTRIENTS[key]),
      sub: sub === true,
      tone: flagged.get(key),
    });
  }
  return rows;
}

/** The four key numbers; one the label didn't give shows a dash. */
export function tiles(nutrition: Nutrition, flagged: FlaggedNutrients): Tile[] {
  return TILES.map(({ key, name, unitShown }) => ({
    name,
    value: tileValue(
      readValue(nutrition, key),
      unitShown ? LABEL_NUTRIENTS[key] : ""
    ),
    tone: flagged.get(key),
  }));
}

/** "3 g", or the number alone with no unit, or a dash when it's missing. */
function tileValue(value: number | string | undefined, unit: string): string {
  if (value === undefined) return "–";
  if (!unit) return String(value);
  return format(value, unit);
}
