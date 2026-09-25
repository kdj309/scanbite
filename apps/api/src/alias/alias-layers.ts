import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Ingredient,
  IngredientDocument,
} from "../database/schemas/ingredient.schema";
import {
  IngredientAlias,
  IngredientAliasDocument,
} from "../database/schemas/ingredient-alias.schema";
import type { AliasLayer, AliasMatch } from "./alias-layer";
import { normalizeAliasText } from "./alias-layer";

@Injectable()
export class ExactAliasLayer implements AliasLayer {
  constructor(
    @InjectModel(IngredientAlias.name)
    private readonly aliases: Model<IngredientAliasDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredients: Model<IngredientDocument>,
  ) {}

  async resolve(raw: string): Promise<AliasMatch | null> {
    const text = normalizeAliasText(raw);
    if (!text) {
      return null;
    }

    const alias = await this.aliases.findOne({ alias_text: text }).exec();
    if (alias) {
      return { ingredientId: String(alias.ingredient_id), layer: 1 };
    }

    const canonical = await this.ingredients
      .findOne({ canonical_name: new RegExp(`^${escapeRegex(text)}$`, "i") })
      .exec();
    if (canonical) {
      return { ingredientId: canonical.id as string, layer: 1 };
    }

    return null;
  }
}

@Injectable()
export class SimilarityAliasLayer implements AliasLayer {
  async resolve(_raw: string): Promise<AliasMatch | null> {
    return null;
  }
}

@Injectable()
export class EmbeddingAliasLayer implements AliasLayer {
  async resolve(_raw: string): Promise<AliasMatch | null> {
    return null;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
