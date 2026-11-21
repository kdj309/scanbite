/**
 * Reads one product from the Open Food Facts v2 API: the live lookup
 * (off-lookup.service.ts) and the admin scripts that re-fetch the catalogue.
 */
import { setTimeout as sleep } from "node:timers/promises";
import { fetchWithTimeout } from "../common/fetch-with-timeout";
import type { OffProductPayload } from "./off-extraction";
import type { OffProductFetch } from "./off-fetch.types";

/** Identifies the app to OFF per their API usage guidelines, not an auth credential. */
export const OFF_USER_AGENT =
  "ScanBite/1.0 (+https://github.com/kdj309/scanbite)";

const RETRY_PAUSE_MS = 30_000;

/** One product's `fields` (comma-separated OFF field names). */
export async function fetchOffProduct(
  barcode: string,
  fields: string
): Promise<OffProductFetch> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode
  )}.json?fields=${fields}`;
  try {
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": OFF_USER_AGENT },
    });
    // OFF answers an unknown barcode with 404 and {"status": 0}.
    if (response.status === 404) {
      return { kind: "not_on_off" };
    }
    if (!response.ok) {
      return { kind: "failed", reason: `HTTP ${response.status}` };
    }
    const payload = (await response.json()) as OffProductPayload;
    if (payload.status !== 1 || !payload.product) {
      return { kind: "not_on_off" };
    }
    return { kind: "found", product: payload.product };
  } catch (error) {
    return { kind: "failed", reason: (error as Error).message };
  }
}

/** One retry after a pause (429 = OFF asking us to slow down, or a blip). */
export async function fetchOffProductWithRetry(
  barcode: string,
  fields: string
): Promise<OffProductFetch> {
  const first = await fetchOffProduct(barcode, fields);
  if (first.kind !== "failed") {
    return first;
  }
  await sleep(RETRY_PAUSE_MS);
  return fetchOffProduct(barcode, fields);
}
