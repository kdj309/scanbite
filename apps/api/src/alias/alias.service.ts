import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  UnresolvedTerm,
  UnresolvedTermDocument,
} from "../database/schemas/unresolved-term.schema";
import {
  EmbeddingAliasLayer,
  ExactAliasLayer,
  SimilarityAliasLayer,
} from "./alias-layers";
import type { AliasMatch } from "./alias-layer";

export type ResolvedIngredient =
  | { status: "resolved"; canonical_id: string; layer: 1 | 2 | 3 }
  | { status: "unresolved"; canonical_id: null };

@Injectable()
export class AliasService {
  constructor(
    private readonly exact: ExactAliasLayer,
    private readonly similarity: SimilarityAliasLayer,
    private readonly embedding: EmbeddingAliasLayer,
    @InjectModel(UnresolvedTerm.name)
    private readonly unresolved: Model<UnresolvedTermDocument>,
  ) {}

  async resolveRaw(raw: string): Promise<ResolvedIngredient> {
    const match =
      (await this.exact.resolve(raw)) ??
      (await this.similarity.resolve(raw)) ??
      (await this.embedding.resolve(raw));
    if (match) {
      return {
        status: "resolved",
        canonical_id: match.ingredientId,
        layer: match.layer,
      };
    }
    await this.recordUnresolved(raw);
    return { status: "unresolved", canonical_id: null };
  }

  async recordUnresolved(raw: string): Promise<void> {
    const now = new Date();
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    await this.unresolved
      .findOneAndUpdate(
        { raw_string: trimmed },
        {
          $inc: { occurrence_count: 1 },
          $set: { last_seen: now },
          $setOnInsert: {
            raw_string: trimmed,
            first_seen: now,
            status: "pending",
          },
        },
        { upsert: true },
      )
      .exec();
  }

  /** Exposed for tests / workers that want a single layer-1 lookup. */
  async resolveLayer1(raw: string): Promise<AliasMatch | null> {
    return this.exact.resolve(raw);
  }
}
