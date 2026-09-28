import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  HEALTH_CONDITION_CODES,
  type HealthConditionCode,
} from "@foodscanner/shared";
import { HydratedDocument } from "mongoose";
import type { RuleOperator } from "./rule-set.schema";

@Schema({ collection: "personalization_rules", timestamps: false })
export class PersonalizationRule {
  @Prop({ required: true })
  version!: string;

  @Prop({ type: Date, required: true })
  effective_from!: Date;

  @Prop({ type: Date, default: null })
  effective_to!: Date | null;

  @Prop({ required: true, enum: [...HEALTH_CONDITION_CODES] })
  condition!: HealthConditionCode;

  // Trigger, structured the same way base scoring rules are (RuleDefinition)
  // instead of a string like "sugar_per_100g > 15" parsed back apart at
  // evaluation time — one condition shape for the whole rules engine.
  @Prop({ required: true })
  field!: string;

  @Prop({ required: true, enum: [">", ">=", "<", "<=", "==", "contains"] })
  operator!: RuleOperator;

  @Prop({ type: Number })
  threshold?: number;

  @Prop({ type: Object })
  value?: unknown;

  @Prop({ required: true })
  effect!: string;

  @Prop({ required: true })
  message!: string;
}

export type PersonalizationRuleDocument = HydratedDocument<PersonalizationRule>;
export const PersonalizationRuleSchema =
  SchemaFactory.createForClass(PersonalizationRule);

PersonalizationRuleSchema.index({ effective_from: 1, effective_to: 1 });
