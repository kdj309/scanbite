import { MAX_SUBMISSION_PHOTOS } from "@foodscanner/shared";

/**
 * Shared across every real VisionPort adapter so Gemini and Claude are
 * asked the exact same question — matches docs/research/vision-eval's
 * validated prompt shape, extended for unlabeled multi-photo capture and
 * the photo_consistency field (neither existed when the eval ran).
 */
export const EXTRACTION_PROMPT = `You are extracting structured nutrition/ingredient data for a single packaged food product from up to ${MAX_SUBMISSION_PHOTOS} photos taken by a phone camera. The photos are NOT labeled by content — together they may show the front of the pack, the ingredients list, and/or the nutrition facts table, in any order, and some may be missing. They may also be frames from one short video of the pack, so several can show the same label from slightly different angles — that is still one product.

Steps:
1. Look at every photo and identify what each one actually shows.
2. If the photos clearly do NOT all belong to the same single product (different branding, different packaging design), set "photo_consistency" to "inconsistent" and do not attempt to merge their data into one answer.
3. Otherwise set "photo_consistency" to "consistent" and extract whatever structured data is legible across all the photos combined.
4. Only report what you can actually read. Do not fill in plausible values from brand recognition or memory of similar products — if something isn't legible, omit it and lower extraction_confidence instead of guessing.

Return ONLY valid JSON matching this exact shape (no markdown fences, no commentary):
{
  "name": string,
  "brand": string,
  "category": string,
  "ingredients": string[],
  "nutrition": { [key: string]: number | string | null },
  "nova_group": number | null,
  "additive_count": number,
  "extraction_confidence": number,
  "photo_consistency": "consistent" | "inconsistent"
}

Nutrition keys: use ONLY these names, each ending in _per_100g (or _per_100ml if the label gives values per 100 ml), with the per-100 value, not per serving. Leave out any nutrient not in this list. Give each value as a string copied exactly as printed, with its unit and any "<" — "17.47 g", "<0.1 g", "480 mg", "574.78 kcal" — and don't convert it yourself. If the unit is printed only in the row or column heading ("Sodium (mg)"), add it to the value. The letter after a number is its unit, not a digit: "0.1g" is "0.1 g", never "0.19".
- energy_kcal
- protein, carbohydrate, total_fat, saturated_fat, trans_fat
- sugar — the label's total sugars
- added_sugar
- cholesterol
- sodium
For example: "sugar_per_100g": "12.5 g", "sodium_per_100g": "0.48 g". If the product name/brand isn't visible in these photos, use "unknown".`;
