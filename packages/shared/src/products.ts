import { z } from "zod";
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
  // vision model from a user's label photos.
  source: z.enum(["catalog", "ai_photos"]),
  // ai_photos only: true until a different person's photos match it
  // ("Read by AI · verifying").
  verifying: z.boolean(),
  // Open Food Facts front photo (CC BY-SA — credit it); null otherwise.
  image_url: z.string().nullable(),
  // Pack size as printed, e.g. "1.25 l".
  quantity: z.string().nullable(),
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

export const catalogQuerySchema = z.object({
  member_id: objectIdSchema.optional(),
  category: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  severity: severitySchema.optional(),
  q: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: objectIdSchema.optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const catalogItemSchema = z.object({
  product: productSummarySchema,
  verdict: verdictSchema,
  confidence: confidenceSchema,
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const catalogResponseSchema = z.object({
  member_has_health_profile: z.boolean(),
  items: z.array(catalogItemSchema),
  next_cursor: objectIdSchema.nullable(),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
