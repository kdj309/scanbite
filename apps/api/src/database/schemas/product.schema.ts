import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

@Schema({
  collection: "products",
  timestamps: { createdAt: "created_at", updatedAt: false },
})
export class Product {
  @Prop({ required: true, trim: true })
  barcode!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: "ProductVersion" })
  current_version_id?: Types.ObjectId;

  created_at!: Date;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ barcode: 1 }, { unique: true });
