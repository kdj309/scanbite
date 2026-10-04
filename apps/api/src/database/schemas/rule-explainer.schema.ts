import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HealthConditionCode } from "@foodscanner/shared";
import { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class ConditionVariant {
  @Prop({ required: true })
  condition!: HealthConditionCode;

  @Prop({ required: true, trim: true })
  addendum!: string;
}

const ConditionVariantSchema = SchemaFactory.createForClass(ConditionVariant);

@Schema({
  collection: "rule_explainers",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
})
export class RuleExplainer {
  @Prop({ required: true, type: [String] })
  rule_ids!: string[];

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  explainer!: string;

  @Prop({ type: [ConditionVariantSchema], default: [] })
  condition_variants!: ConditionVariant[];

  @Prop({ required: true, trim: true })
  citations!: string;

  created_at!: Date;
  updated_at!: Date;
}

export type RuleExplainerDocument = HydratedDocument<RuleExplainer>;
export const RuleExplainerSchema = SchemaFactory.createForClass(RuleExplainer);

RuleExplainerSchema.index({ rule_ids: 1 });
