import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ObjectStorageService } from "../../common/object-storage.service";
import type { Env } from "../../config/env";
import type { ExtractionOutput } from "./extraction-output";
import { callVisionApi } from "./vision-api-client";
import type { VisionPort } from "./vision.port";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_TOKENS = 1500;

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

/**
 * Primary tier of the vision pipeline (HLD §9 decision, 2026-09-30 eval):
 * Gemini Flash via OpenRouter, matching exactly how the eval validated it
 * (docs/research/vision-eval/run-eval.mjs `callGeminiFlash`) — Gemini has
 * no direct-API path tested, so this is the only production route we have
 * real accuracy/calibration numbers for.
 */
@Injectable()
export class GeminiVisionAdapter implements VisionPort {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly storage: ObjectStorageService
  ) {}

  async extract(input: {
    barcode: string;
    photoKeys: string[];
  }): Promise<ExtractionOutput> {
    const apiKey = this.config.get("OPENROUTER_API_KEY", { infer: true });
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
    const model = this.config.get("GEMINI_OPENROUTER_MODEL", { infer: true });

    return callVisionApi(this.storage, input.photoKeys, {
      url: OPENROUTER_URL,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/kdj309/scanbite",
        "X-Title": "ScanBite vision extraction",
      },
      providerLabel: `Gemini (OpenRouter, model=${model})`,
      buildBody: (prompt, photos) => ({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...photos.map((photo) => ({
                type: "image_url",
                image_url: {
                  url: `data:${photo.mediaType};base64,${photo.base64}`,
                },
              })),
            ],
          },
        ],
      }),
      extractText: (json) =>
        (json as OpenRouterResponse).choices?.[0]?.message?.content ?? "",
    });
  }
}
