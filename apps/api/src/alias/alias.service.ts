import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  UnresolvedTerm,
  UnresolvedTermDocument,
} from "../database/schemas/unresolved-term.schema";
import { ExactAliasLayer } from "./alias-layers";

export type ResolvedIngredient =
  | { status: "resolved"; canonical_id: string }
  | { status: "unresolved"; canonical_id: null };

@Injectable()
export class AliasService {
  constructor(
    private readonly exact: ExactAliasLayer,
    @InjectModel(UnresolvedTerm.name)
    private readonly unresolved: Model<UnresolvedTermDocument>
  ) {}

  async resolveRaw(raw: string): Promise<ResolvedIngredient> {
    const match = await this.exact.resolve(raw);
    if (match) {
      return { status: "resolved", canonical_id: match.ingredientId };
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
        { upsert: true }
      )
      .exec();
  }
}
