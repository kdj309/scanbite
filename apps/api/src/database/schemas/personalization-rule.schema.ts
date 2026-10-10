import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  HEALTH_CONDITION_CODES,
  type HealthConditionCode,
} from "@foodscanner/shared";
import { HydratedDocument } from "mongoose";
import {
  PRODUCT_FORMS,
  RULE_OPERATORS,
  type ProductForm,
  type RuleOperator,
} from "./rule-set.schema";

/** What a matching rule does. Matched by value, never by text search. */
export const PERSONALIZATION_EFFECTS = ["escalate one level"] as const;
export type PersonalizationEffect = (typeof PERSONALIZATION_EFFECTS)[number];

@Schema({ collection: "personalization_rules", timestamps: false })
export class PersonalizationRule {
  @Prop({ required: true, trim: true })
  id!: string;

  @Prop({ required: true })
  version!: string;

  @Prop({ type: Date, required: true })
  effective_from!: Date;

  @Prop({ type: Date, default: null })
  effective_to!: Date | null;

  @Prop({ required: true, enum: [...HEALTH_CONDITION_CODES] })
  condition!: HealthConditionCode;

  @Prop({ required: true })
  field!: string;

  @Prop({ required: true, enum: RULE_OPERATORS })
  operator!: RuleOperator;

  @Prop({ type: Number })
  threshold?: number;

  @Prop({ type: Object })
  value?: unknown;

  @Prop({ required: true, enum: PERSONALIZATION_EFFECTS })
  effect!: PersonalizationEffect;

  @Prop({ required: true })
  message!: string;

  /** Short chip text for the app, e.g. "Too sweet for diabetes". */
  @Prop()
  label?: string;

  /** Scopes this rule to solid or liquid products; omitted/"any" = both. */
  @Prop({ enum: PRODUCT_FORMS })
  applies_to?: ProductForm;
}

export type PersonalizationRuleDocument = HydratedDocument<PersonalizationRule>;
export const PersonalizationRuleSchema =
  SchemaFactory.createForClass(PersonalizationRule);

PersonalizationRuleSchema.index({ effective_from: 1, effective_to: 1 });
// `id` is the rule's identity (reasons' rule_id, explainers); a rule may
// have several versions, but never two copies of the same version — this
// also makes concurrent seed upserts from several workers safe.
PersonalizationRuleSchema.index({ id: 1, version: 1 }, { unique: true });
