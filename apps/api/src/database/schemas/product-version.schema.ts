import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ALLERGEN_CODES, type DeclaredVeg } from "@foodscanner/shared";
import { HydratedDocument, Types } from "mongoose";
import type { DeclaredAllergens } from "../../allergens/allergen-evidence";

export type IngredientStatus = "resolved" | "unresolved";
/**
 * "manual_seed" is distinct from "off" even though the underlying data
 * originates from OFF — it's a committed snapshot curated before launch
 * (see admin/seed-common-products.ts), not a live, completeness-tag-scored
 * API fetch. Keeping it separate preserves accurate provenance.
 */
export type ProductVersionSource = "off" | "user_submission" | "manual_seed";
export type ProductVersionStatus = "live" | "pending" | "superseded";

@Schema({ _id: false })
export class VersionIngredient {
  @Prop({ required: true, trim: true })
  raw!: string;

  @Prop({ type: Types.ObjectId, ref: "Ingredient", default: null })
  canonical_id!: Types.ObjectId | null;

  @Prop({ required: true, enum: ["resolved", "unresolved"] })
  status!: IngredientStatus;
}

const VersionIngredientSchema = SchemaFactory.createForClass(VersionIngredient);

@Schema({
  collection: "product_versions",
  timestamps: { createdAt: "created_at", updatedAt: false },
})
export class ProductVersion {
  @Prop({ type: Types.ObjectId, ref: "Product", required: true })
  product_id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  barcode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  brand!: string;

  @Prop({ required: true, trim: true })
  category!: string;

  @Prop({ type: [VersionIngredientSchema], default: [] })
  ingredients!: VersionIngredient[];

  @Prop({ type: Object, default: {} })
  nutrition!: Record<string, number | string | null>;

  @Prop({ type: Number })
  nova_group?: number;

  @Prop({ type: Number })
  additive_count?: number;

  @Prop({ min: 0, max: 1 })
  extraction_confidence?: number;

  @Prop({ required: true, enum: ["off", "user_submission", "manual_seed"] })
  source!: ProductVersionSource;

  @Prop({ required: true, enum: ["live", "pending", "superseded"] })
  status!: ProductVersionStatus;

  /** Front-of-pack photo from OFF; photo-added products have none (yet). */
  @Prop({ type: String, default: null })
  image_url!: string | null;

  /** What the pack declares ("Contains" / "May contain"); null = unknown.
   *  Our own ingredient-name scan is added at serve time (allergens/). */
  @Prop({
    type: {
      contains: [{ type: String, enum: ALLERGEN_CODES }],
      may_contain: [{ type: String, enum: ALLERGEN_CODES }],
    },
    _id: false,
    default: null,
  })
  declared_allergens!: DeclaredAllergens | null;

  /** The pack's FSSAI veg/non-veg symbol; null = not known. */
  @Prop({ type: String, enum: ["veg", "non_veg"], default: null })
  declared_veg!: DeclaredVeg | null;

  /** Pack size as printed, e.g. "1.25 l". */
  @Prop({ type: String, default: null })
  quantity!: string | null;

  /** user_submission only: who sent the photos it was read from. */
  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  submitted_by!: Types.ObjectId | null;

  /** user_submission only: when a different user's photos matched it. */
  @Prop({ type: Date, default: null })
  confirmed_at!: Date | null;

  created_at!: Date;
}

export type ProductVersionDocument = HydratedDocument<ProductVersion>;
export const ProductVersionSchema =
  SchemaFactory.createForClass(ProductVersion);

ProductVersionSchema.index({ product_id: 1, status: 1 });
ProductVersionSchema.index({ barcode: 1, status: 1 });
// Catalog search/filter (HLD §15) — the indexes above only serve
// single-barcode lookups, not category/brand filter queries.
ProductVersionSchema.index({ status: 1, category: 1 });
ProductVersionSchema.index({ status: 1, brand: 1 });
