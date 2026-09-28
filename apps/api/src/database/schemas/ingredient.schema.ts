import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ collection: "ingredients", timestamps: false })
export class Ingredient {
  @Prop({ required: true, unique: true, trim: true })
  canonical_name!: string;

  @Prop({ required: true, trim: true })
  category!: string;

  @Prop({ trim: true })
  ins_code?: string;

  @Prop({ trim: true })
  off_taxonomy_id?: string;
}

export type IngredientDocument = HydratedDocument<Ingredient>;
export const IngredientSchema = SchemaFactory.createForClass(Ingredient);
IngredientSchema.index({ off_taxonomy_id: 1 }, { unique: true, sparse: true });
