import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ collection: "personalization_rules", timestamps: false })
export class PersonalizationRule {
  @Prop({ required: true })
  version!: string;

  @Prop({ required: true })
  condition!: string;

  @Prop({ required: true })
  trigger!: string;

  @Prop({ required: true })
  effect!: string;

  @Prop({ required: true })
  message!: string;
}

export type PersonalizationRuleDocument = HydratedDocument<PersonalizationRule>;
export const PersonalizationRuleSchema =
  SchemaFactory.createForClass(PersonalizationRule);

PersonalizationRuleSchema.index({ version: 1 });
