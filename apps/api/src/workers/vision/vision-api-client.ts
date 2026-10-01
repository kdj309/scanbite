import { fetchWithTimeout } from "../../common/fetch-with-timeout";
import type { ObjectStorageService } from "../../common/object-storage.service";
import { EXTRACTION_PROMPT } from "./extraction-prompt";
import type { ExtractionOutput } from "./extraction-output";
import { parseExtractionResponse } from "./parse-extraction-response";
import { loadPhotosAsBase64, type PhotoPayload } from "./vision-photos";

export type VisionApiRequest = {
  url: string;
  headers: Record<string, string>;
  providerLabel: string;
  /** Builds the provider-specific request body — the one part each adapter can't share. */
  buildBody: (prompt: string, photos: PhotoPayload[]) => unknown;
  /** Pulls the model's text reply out of the provider-specific response envelope. */
  extractText: (json: unknown) => string;
};

/**
 * Shared "download photos, call the API, validate the JSON" skeleton for
 * every real VisionPort adapter. Gemini and Claude only differ in URL,
 * auth header, request/response wire shape — everything else (timeout,
 * error wrapping, schema validation) should behave identically for both so
 * a bug fix here doesn't need to be made twice.
 */
export async function callVisionApi(
  storage: ObjectStorageService,
  photoKeys: string[],
  request: VisionApiRequest
): Promise<ExtractionOutput> {
  const photos = await loadPhotosAsBase64(storage, photoKeys);

  const response = await fetchWithTimeout(request.url, {
    method: "POST",
    headers: { "content-type": "application/json", ...request.headers },
    body: JSON.stringify(request.buildBody(EXTRACTION_PROMPT, photos)),
  });
  if (!response.ok) {
    throw new Error(
      `${request.providerLabel} HTTP ${response.status}: ${await response.text()}`
    );
  }
  const json = await response.json();
  return parseExtractionResponse(request.extractText(json));
}
