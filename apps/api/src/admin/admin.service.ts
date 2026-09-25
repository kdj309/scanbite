import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  ListUnresolvedTermsResponse,
  ResolveUnresolvedTermRequest,
  ResolveUnresolvedTermResponse,
  UnresolvedTerm as UnresolvedTermDto,
} from "@foodscanner/shared";
import { Model } from "mongoose";
import { toIso } from "../common/dates";
import { normalizeAliasText } from "../alias/alias-layer";
import {
  Ingredient,
  IngredientDocument,
} from "../database/schemas/ingredient.schema";
import {
  IngredientAlias,
  IngredientAliasDocument,
} from "../database/schemas/ingredient-alias.schema";
import {
  UnresolvedTerm,
  UnresolvedTermDocument,
} from "../database/schemas/unresolved-term.schema";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(UnresolvedTerm.name)
    private readonly terms: Model<UnresolvedTermDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredients: Model<IngredientDocument>,
    @InjectModel(IngredientAlias.name)
    private readonly aliases: Model<IngredientAliasDocument>,
  ) {}

  async listUnresolved(): Promise<ListUnresolvedTermsResponse> {
    const docs = await this.terms
      .find({ status: "pending" })
      .sort({ occurrence_count: -1, last_seen: -1 })
      .exec();
    return { items: docs.map(serializeTerm) };
  }

  async resolve(
    id: string,
    body: ResolveUnresolvedTermRequest,
  ): Promise<ResolveUnresolvedTermResponse> {
    const term = await this.terms.findById(id).exec();
    if (!term) {
      throw new NotFoundException("Unresolved term not found");
    }

    const ingredientId = body.canonical_ingredient_id
      ? await this.requireIngredient(body.canonical_ingredient_id)
      : await this.createIngredient(body);

    const aliasText = normalizeAliasText(term.raw_string);
    await this.aliases.updateOne(
      { alias_text: aliasText },
      {
        $setOnInsert: {
          alias_text: aliasText,
          ingredient_id: ingredientId,
        },
      },
      { upsert: true },
    );

    term.status = "resolved";
    await term.save();

    return {
      unresolved_term_id: term.id as string,
      ingredient_id: ingredientId,
    };
  }

  private async requireIngredient(id: string): Promise<string> {
    const ingredient = await this.ingredients.findById(id).exec();
    if (!ingredient) {
      throw new NotFoundException("Ingredient not found");
    }
    return ingredient.id as string;
  }

  private async createIngredient(
    body: ResolveUnresolvedTermRequest,
  ): Promise<string> {
    if (!body.new_ingredient) {
      throw new BadRequestException("new_ingredient is required");
    }
    const created = await this.ingredients.create({
      canonical_name: body.new_ingredient.canonical_name,
      category: body.new_ingredient.category ?? "unknown",
      ins_code: body.new_ingredient.ins_code,
    });
    return created.id as string;
  }
}

function serializeTerm(term: UnresolvedTermDocument): UnresolvedTermDto {
  return {
    id: term.id as string,
    raw_string: term.raw_string,
    occurrence_count: term.occurrence_count,
    first_seen: toIso(term.first_seen),
    last_seen: toIso(term.last_seen),
    status: term.status,
  };
}
