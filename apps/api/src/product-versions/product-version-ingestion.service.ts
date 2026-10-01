import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AliasService } from "../alias/alias.service";
import { isDuplicateKeyError } from "../common/mongo-errors";
import { Product, ProductDocument } from "../database/schemas/product.schema";
import {
  ProductVersion,
  ProductVersionDocument,
  ProductVersionSource,
} from "../database/schemas/product-version.schema";
import { ScoringService } from "../scoring/scoring.service";

export type ResolvedIngredientRow = {
  raw: string;
  canonical_id: Types.ObjectId | null;
  status: "resolved" | "unresolved";
};

/**
 * Shared "create a pending product version and score it" path used by both
 * the vision-LLM submission pipeline and the OFF-seed lookup path, so the
 * two never drift into slightly different product/ingredient-creation
 * behavior.
 */
@Injectable()
export class ProductVersionIngestionService {
  constructor(
    @InjectModel(Product.name)
    private readonly products: Model<ProductDocument>,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly alias: AliasService,
    private readonly scoring: ScoringService
  ) {}

  async resolveIngredients(raws: string[]): Promise<ResolvedIngredientRow[]> {
    const resolved = await Promise.all(
      raws.map((raw) => this.alias.resolveRaw(raw))
    );
    return raws.map((raw, index) => ({
      raw,
      canonical_id: resolved[index].canonical_id
        ? new Types.ObjectId(resolved[index].canonical_id)
        : null,
      status: resolved[index].status,
    }));
  }

  async findOrCreateProduct(barcode: string): Promise<ProductDocument> {
    const existing = await this.products.findOne({ barcode }).exec();
    if (existing) {
      return existing;
    }
    try {
      return await this.products.create({ barcode });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const raced = await this.products.findOne({ barcode }).exec();
      if (!raced) {
        throw error;
      }
      return raced;
    }
  }

  async createPendingVersion(input: {
    barcode: string;
    name: string;
    brand: string;
    category: string;
    ingredients: ResolvedIngredientRow[];
    nutrition: Record<string, number | string | null>;
    nova_group?: number;
    additive_count?: number;
    extraction_confidence: number;
    source: ProductVersionSource;
  }): Promise<ProductVersionDocument> {
    const product = await this.findOrCreateProduct(input.barcode);
    const pending = await this.versions.create({
      product_id: product._id,
      barcode: input.barcode,
      name: input.name,
      brand: input.brand,
      category: input.category,
      ingredients: input.ingredients,
      nutrition: input.nutrition,
      nova_group: input.nova_group,
      additive_count: input.additive_count,
      extraction_confidence: input.extraction_confidence,
      source: input.source,
      status: "pending",
    });
    await this.scoring.ensureScoringRecord(pending);
    return pending;
  }
}
