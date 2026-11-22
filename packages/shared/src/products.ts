import { z } from "zod";
import { nutritionSchema } from "./nutrition";
import { confidenceSchema, objectIdSchema, severitySchema } from "./primitives";

// GTIN family: EAN-8, UPC-A (12), EAN-13, GTIN-14.
export const barcodeSchema = z
  .string()
  .regex(/^\d{8,14}$/, "Barcode must be 8–14 digits");

const reasonFields = {
  // Short chip text, e.g. "High sugar".
  label: z.string(),
  text: z.string(),
  // The rule behind it — the app fetches its explainer (GET /rule-explainers).
  rule_id: z.string(),
};

/** The rule matched. */
export const flagReasonSchema = z.object({
  kind: z.literal("flag"),
  severity: severitySchema,
  ...reasonFields,
  // The fact the rule read ("sodium_per_100g", "nova_group"), so the app
  // can mark a flagged nutrient.
  field: z.string().optional(),
});
export type FlagReason = z.infer<typeof flagReasonSchema>;

/** The fact the rule needs was missing, so we couldn't tell — never a pass. */
export const uncheckedReasonSchema = z.object({
  kind: z.literal("unchecked"),
  ...reasonFields,
});
export type UncheckedReason = z.infer<typeof uncheckedReasonSchema>;

// `reasons` is ordered: flags first, worst severity first (on a tie the
// member's condition rule before a general one), then "unchecked" gaps.
// So reasons[0], when it is a flag, is the main reason for the verdict.
export const verdictReasonSchema = z.discriminatedUnion("kind", [
  flagReasonSchema,
  uncheckedReasonSchema,
]);
export type VerdictReason = z.infer<typeof verdictReasonSchema>;

// "What we checked": topics actually checked and passed — never one that was
// flagged, and never one we couldn't check (that's an "unchecked" reason).
// `for` says what else it was checked against — their condition or allergy —
// and is empty for a general check: { label: "Salt", for: [] },
// { label: "Sugar", for: ["diabetes"] }, { label: "Peanuts", for: ["allergy"] }.
export const checkSchema = z.object({
  label: z.string(),
  for: z.array(z.string()),
});
export type Check = z.infer<typeof checkSchema>;

export const verdictSchema = z.object({
  severity: severitySchema,
  reasons: z.array(verdictReasonSchema),
  checked: z.array(checkSchema),
});
export type Verdict = z.infer<typeof verdictSchema>;

// The pack's FSSAI green dot / brown triangle (mandatory on Indian packs).
// "unknown" when we don't know the symbol — never guessed from ingredients.
export const vegStatusSchema = z.enum(["veg", "non_veg", "unknown"]);
export type VegStatus = z.infer<typeof vegStatusSchema>;
export type DeclaredVeg = Exclude<VegStatus, "unknown">;

// "Buy on Amazon / BigBasket": search links (the user picks the exact item).
// `affiliate` = the link may earn us a commission, so the app must show the
// store's required disclosure next to it. The app shows these only where
// the design does (Safe verdicts, better options) — never ranking by them.
export const buyLinkSchema = z.object({
  store: z.enum(["amazon", "bigbasket"]),
  url: z.string().url(),
  affiliate: z.boolean(),
});
export type BuyLink = z.infer<typeof buyLinkSchema>;

export const productSummarySchema = z.object({
  name: z.string(),
  brand: z.string(),
  product_version_id: objectIdSchema,
  // "catalog": Open Food Facts or our curated seed. "ai_photos": read by the
  // vision model from a user's label photos. "label_check": a pack with no
  // barcode, read from one person's photos for them alone — never a catalog
  // product, so product_version_id is the label check's id and there are no
  // buy links (design 2d).
  source: z.enum(["catalog", "ai_photos", "label_check"]),
  // ai_photos only: true until a different person's photos match it
  // (shown as "Read by AI from the label").
  verifying: z.boolean(),
  // false = no ingredients list was read, so there's no verdict to show:
  // the app shows "Couldn't read the label" (design 2c) and offers to scan
  // the label again.
  has_ingredients: z.boolean(),
  // Open Food Facts front photo (CC BY-SA — credit it); null otherwise.
  image_url: z.string().nullable(),
  // Pack size as printed, e.g. "1.25 l".
  quantity: z.string().nullable(),
  // Where it's compared for better options ("Salty snacks"); null when we
  // can't tell, so the app doesn't offer better options.
  shelf: z.string().nullable(),
  veg: vegStatusSchema,
  buy_links: z.array(buyLinkSchema),
});
export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productNotFoundResponseSchema = z.object({
  found: z.literal(false),
});
export type ProductNotFoundResponse = z.infer<
  typeof productNotFoundResponseSchema
>;

export const memberVerdictSchema = z.object({
  member_id: objectIdSchema,
  name: z.string(),
  // false = no conditions or allergies yet: `verdict` is the general one,
  // and the app shows "Analyze for you" instead of treating it as checked
  // for them.
  has_health_profile: z.boolean(),
  verdict: verdictSchema,
});
export type MemberVerdict = z.infer<typeof memberVerdictSchema>;

export const productFoundResponseSchema = z.object({
  found: z.literal(true),
  product: productSummarySchema,
  // Worst verdict among members with a health profile (conditions or
  // allergies), and whose it is (the person the verdict screen opens on).
  // With no profile anywhere yet,
  // the general verdict and member_id null. When it's green everyone ties,
  // so member_id is just the first of them — the app opens on "All".
  overall: z.object({
    severity: severitySchema,
    member_id: objectIdSchema.nullable(),
  }),
  // Every household member, in household order — the "See it for"
  // switcher reads from here without another request.
  members: z.array(memberVerdictSchema),
  confidence: confidenceSchema,
  unresolved_ingredients: z.array(z.string()),
  // What the verdict was decided from (How we decided, design 12a): the
  // ingredients as read, and nutrition per 100 g or 100 ml as stored
  // (keys like "sugar_per_100g"; text when the label's value wasn't a number).
  ingredients: z.array(z.string()),
  nutrition: nutritionSchema,
});
export type ProductFoundResponse = z.infer<typeof productFoundResponseSchema>;

export const productLookupResponseSchema = z.discriminatedUnion("found", [
  productNotFoundResponseSchema,
  productFoundResponseSchema,
]);
export type ProductLookupResponse = z.infer<typeof productLookupResponseSchema>;

// Explore's category chips. `name` is the value to pass back as
// GET /products?category=…; `count` matches what that returns.
export const categorySchema = z.object({
  name: z.string(),
  count: z.number().int().positive(),
});
export const categoriesResponseSchema = z.object({
  categories: z.array(categorySchema), // biggest first; "unknown" left out
});
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;

export const catalogSectionSchema = z.enum(["good_for_all", "not_for_all"]);
export type CatalogSection = z.infer<typeof catalogSectionSchema>;

export const catalogQuerySchema = z.object({
  category: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
  // "Who are you shopping for?" toggles, comma-separated; only members with
  // a health profile. Default: all of them.
  member_ids: z
    .string()
    .transform((ids) => ids.split(",").filter(Boolean))
    .pipe(z.array(objectIdSchema).min(1))
    .optional(),
  // Explore's "Good for everyone" shelf / "Not for everyone" list. Applied
  // after scoring, so a page can hold fewer than `limit` items.
  section: catalogSectionSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: objectIdSchema.optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const catalogItemSchema = z.object({
  product: productSummarySchema,
  // Worst among the included members, and whose it is.
  overall: z.object({
    severity: severitySchema,
    member_id: objectIdSchema.nullable(),
  }),
  // One ring per included member.
  members: z.array(
    z.object({ member_id: objectIdSchema, severity: severitySchema })
  ),
  // The one chip on a row: the worst verdict's main reason — a flag, or a
  // "Sugar not checked". null only when it's Safe with nothing to say.
  main_reason: z
    .object({
      kind: z.enum(["flag", "unchecked"]),
      label: z.string(),
      rule_id: z.string(),
    })
    .nullable(),
  confidence: confidenceSchema,
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const catalogResponseSchema = z.object({
  // Who's included; empty when nobody has a health profile yet (then it's
  // the general verdict, and the app shows "Analyze for you").
  for_member_ids: z.array(objectIdSchema),
  items: z.array(catalogItemSchema), // within a page: worst first
  next_cursor: objectIdSchema.nullable(),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

// Search from Home (design 1e): products only, no verdicts; opening one
// asks for its verdict like a scan does.
export const productSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(60),
});
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const productSearchItemSchema = z.object({
  barcode: barcodeSchema,
  name: z.string(),
  brand: z.string(),
  // Open Food Facts front photo (CC BY-SA); null otherwise.
  image_url: z.string().nullable(),
  quantity: z.string().nullable(),
});
export type ProductSearchItem = z.infer<typeof productSearchItemSchema>;

export const productSearchResponseSchema = z.object({
  items: z.array(productSearchItemSchema), // best match first
});
export type ProductSearchResponse = z.infer<typeof productSearchResponseSchema>;
