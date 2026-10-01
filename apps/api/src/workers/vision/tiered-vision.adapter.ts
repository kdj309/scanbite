import { Injectable, Logger } from "@nestjs/common";
import { ClaudeVisionAdapter } from "./claude-vision.adapter";
import type { ExtractionOutput } from "./extraction-output";
import { GeminiVisionAdapter } from "./gemini-vision.adapter";
import type { VisionPort } from "./vision.port";

/**
 * Below this, trust Claude's independent read over Gemini's own uncertain
 * one rather than the shaky answer — see docs/research/vision-eval/README.md
 * for the calibration data this threshold is based on.
 */
export const ESCALATION_CONFIDENCE_THRESHOLD = 0.5;

/**
 * HLD §9 decision (2026-09-30 eval): Gemini Flash primary, Claude Sonnet
 * escalation. Escalates on either a failed/unparseable Gemini call or a
 * low-confidence-but-valid one. If the escalation call itself fails, falls
 * back to Gemini's result rather than failing the whole extraction — a
 * low-confidence answer beats none, and it still goes through the normal
 * confidence-gated consensus/needs_review path downstream.
 */
@Injectable()
export class TieredVisionAdapter implements VisionPort {
  private readonly logger = new Logger(TieredVisionAdapter.name);

  constructor(
    private readonly gemini: GeminiVisionAdapter,
    private readonly claude: ClaudeVisionAdapter
  ) {}

  async extract(input: {
    barcode: string;
    photoKeys: string[];
  }): Promise<ExtractionOutput> {
    let primary: ExtractionOutput | undefined;
    try {
      primary = await this.gemini.extract(input);
    } catch (error) {
      this.logger.warn(
        `Gemini extraction failed for ${input.barcode}: ${(error as Error).message}`
      );
    }

    if (
      primary &&
      primary.extraction_confidence >= ESCALATION_CONFIDENCE_THRESHOLD
    ) {
      return primary;
    }

    try {
      return await this.claude.extract(input);
    } catch (error) {
      if (primary) {
        this.logger.warn(
          `Claude escalation failed for ${input.barcode}, falling back to Gemini's lower-confidence result: ${(error as Error).message}`
        );
        return primary;
      }
      throw error;
    }
  }
}
