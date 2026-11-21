import type { OffProduct } from "./off-extraction";

/**
 * Three outcomes, never two: a failed request (OFF down, a timeout, a 429)
 * must not be mistaken for OFF not having the barcode, or a brand-new
 * product would look unknown for hours after a blip.
 */
export type OffProductFetch =
  | { kind: "found"; product: OffProduct }
  | { kind: "not_on_off" }
  | { kind: "failed"; reason: string };
