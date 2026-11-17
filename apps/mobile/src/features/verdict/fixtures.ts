import type {
  HouseholdMember,
  MemberVerdict,
  ProductFoundResponse,
  Severity,
  VerdictReason,
} from "@foodscanner/shared";

/** Shared test data: a family of three and a product flagged for Papa. */
export const YOU = "6ab7d04ffb5027914b128aed";
export const AMMA = "6ab7d04ffb5027914b128aee";
export const PAPA = "6ab7d04ffb5027914b128aef";

export function member(
  id: string,
  fields: Partial<HouseholdMember>
): HouseholdMember {
  return {
    id,
    name: "Self",
    relationship: "self",
    conditions: [],
    allergies: [],
    created_at: "2026-10-17T00:00:00.000Z",
    updated_at: "2026-10-17T00:00:00.000Z",
    ...fields,
  };
}

export const you = member(YOU, {});
export const amma = member(AMMA, {
  name: "Amma",
  relationship: "parent",
  conditions: ["hypertensive"],
});
export const papa = member(PAPA, {
  name: "Papa",
  relationship: "parent",
  conditions: ["diabetic", "hypertensive"],
});

export const flag = (
  rule: string,
  label: string,
  severity: Severity
): VerdictReason => ({
  kind: "flag",
  severity,
  label,
  text: `${label} text`,
  rule_id: rule,
});
export const sugar = flag("diabetic_sugar", "Too sweet for diabetes", "red");
export const nova = flag("nova4", "Ultra-processed", "yellow");
export const palm = flag("palm_oil", "Palm oil", "yellow");

export function verdict(
  m: HouseholdMember,
  severity: Severity,
  reasons: VerdictReason[],
  hasProfile = true
): MemberVerdict {
  return {
    member_id: m.id,
    name: m.name,
    has_health_profile: hasProfile,
    verdict: {
      severity,
      reasons,
      checked: [{ label: "Salt", for: [] }],
    },
  };
}

export function result(
  overall: ProductFoundResponse["overall"],
  members: MemberVerdict[]
): ProductFoundResponse {
  return {
    found: true,
    product: {
      name: "Chocolate malt drink",
      brand: "Brand",
      product_version_id: "6ab7d04ffb5027914b128af1",
      source: "catalog",
      verifying: false,
      has_ingredients: true,
      image_url: null,
      shelf: "Biscuits & cakes",
      quantity: "200 g",
      veg: "veg",
      buy_links: [],
    },
    overall,
    members,
    confidence: "full",
    unresolved_ingredients: [],
    ingredients: [],
    nutrition: {},
  };
}

export const family = [you, amma, papa];
export const flagged = result({ severity: "red", member_id: PAPA }, [
  verdict(you, "yellow", [nova], false),
  verdict(amma, "yellow", [nova, palm]),
  verdict(papa, "red", [sugar, nova, palm]),
]);
