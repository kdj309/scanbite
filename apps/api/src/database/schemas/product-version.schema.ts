import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type IngredientStatus = "resolved" | "unresolved";
export type ProductVersionSource = "off" | "user_submission";
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

  @Prop({ required: true, min: 0, max: 1 })
  extraction_confidence!: number;

  @Prop({ required: true, enum: ["off", "user_submission"] })
  source!: ProductVersionSource;

  @Prop({ required: true, enum: ["live", "pending", "superseded"] })
  status!: ProductVersionStatus;

  created_at!: Date;
}

export type ProductVersionDocument = HydratedDocument<ProductVersion>;
export const ProductVersionSchema = SchemaFactory.createForClass(ProductVersion);

ProductVersionSchema.index({ product_id: 1, status: 1 });
ProductVersionSchema.index({ barcode: 1, status: 1 });
