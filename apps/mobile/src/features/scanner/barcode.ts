/** Retail barcodes the API knows: EAN-13/8 and UPC-A/E. */
export const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"] as const;

/** The digits of a barcode the API accepts (8–14), or null. */
export function parseBarcode(text: string): string | null {
  const digits = text.replace(/\s/g, "");
  return /^\d{8,14}$/.test(digits) ? digits : null;
}
