/**
 * Shared across every real VisionPort adapter so Gemini and Claude are
 * asked the exact same question — matches docs/research/vision-eval's
 * validated prompt shape, extended for unlabeled multi-photo capture and
 * the photo_consistency field (neither existed when the eval ran).
 */
export const EXTRACTION_PROMPT = `You are extracting structured nutrition/ingredient data for a single packaged food product from up to 3 photos taken by a phone camera. The photos are NOT labeled by content — together they may show the front of the pack, the ingredients list, and/or the nutrition facts table, in any order, and some may be missing.

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

Use nutrition keys like sugar_per_100g, sodium_per_100g, energy_kcal_per_100g (or the _per_100ml variants if this is a liquid product) based on what the labels actually show. If the product name/brand isn't visible in these photos, use "unknown".`;
