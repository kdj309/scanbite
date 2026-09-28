import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

@Schema({ collection: "ingredient_aliases", timestamps: false })
export class IngredientAlias {
  @Prop({ type: Types.ObjectId, ref: "Ingredient", required: true })
  ingredient_id!: Types.ObjectId;

  // trim + lowercase are enforced here, not just by callers normalizing
  // before writing — Mongoose applies these on updateOne/$setOnInsert too
  // (verified), so a future writer can't silently create an alias that
  // ExactAliasLayer's normalized lookup can never find.
  @Prop({ required: true, trim: true, lowercase: true })
  alias_text!: string;
}

export type IngredientAliasDocument = HydratedDocument<IngredientAlias>;
export const IngredientAliasSchema =
  SchemaFactory.createForClass(IngredientAlias);

IngredientAliasSchema.index({ alias_text: 1 }, { unique: true });
