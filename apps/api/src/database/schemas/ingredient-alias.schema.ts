import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

@Schema({ collection: "ingredient_aliases", timestamps: false })
export class IngredientAlias {
  @Prop({ type: Types.ObjectId, ref: "Ingredient", required: true })
  ingredient_id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  alias_text!: string;
}

export type IngredientAliasDocument = HydratedDocument<IngredientAlias>;
export const IngredientAliasSchema =
  SchemaFactory.createForClass(IngredientAlias);

IngredientAliasSchema.index({ alias_text: 1 }, { unique: true });
