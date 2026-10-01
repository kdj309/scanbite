import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ObjectStorageService } from "../../common/object-storage.service";
import type { Env } from "../../config/env";
import type { ExtractionOutput } from "./extraction-output";
import { callVisionApi } from "./vision-api-client";
import type { VisionPort } from "./vision.port";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1500;

// Pinned to the exact model the eval validated (docs/research/vision-eval) —
// bumping this needs a re-run of the eval, not just a version swap.
const CLAUDE_MODEL = "claude-sonnet-4-5";

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
};

/**
 * Escalation tier of the vision pipeline (HLD §9 decision, 2026-09-30 eval):
 * only called when Gemini fails or reports low confidence — see
 * TieredVisionAdapter.
 */
@Injectable()
export class ClaudeVisionAdapter implements VisionPort {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly storage: ObjectStorageService
  ) {}

  async extract(input: {
    barcode: string;
    photoKeys: string[];
  }): Promise<ExtractionOutput> {
    const apiKey = this.config.get("ANTHROPIC_API_KEY", { infer: true });
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    return callVisionApi(this.storage, input.photoKeys, {
      url: ANTHROPIC_URL,
      headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
      providerLabel: `Claude (${CLAUDE_MODEL})`,
      buildBody: (prompt, photos) => ({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...photos.map((photo) => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: photo.mediaType,
                  data: photo.base64,
                },
              })),
            ],
          },
        ],
      }),
      extractText: (json) =>
        (json as AnthropicResponse).content?.find(
          (block) => block.type === "text"
        )?.text ?? "",
    });
  }
}
