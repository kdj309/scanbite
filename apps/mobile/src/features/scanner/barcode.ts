/** Retail barcodes the API knows: EAN-13/8 and UPC-A/E. */
export const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"] as const;

/** The digits of a barcode the API accepts (8–14), or null. */
export function parseBarcode(text: string): string | null {
  const digits = text.replace(/\s/g, "");
  return /^\d{8,14}$/.test(digits) ? digits : null;
}

/** Reads in a row that must agree before a code counts. */
const MATCHING_READS = 2;

/**
 * A camera read is trusted once the same code comes twice in a row: the
 * camera reports many times a second, and a one-off misread (which can
 * still have a valid check digit) doesn't repeat.
 */
export function createReadConfirmer() {
  let last: string | null = null;
  let count = 0;
  return (barcode: string): boolean => {
    count = barcode === last ? count + 1 : 1;
    last = barcode;
    return count >= MATCHING_READS;
  };
}
