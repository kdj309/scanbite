import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { severitySchema, type Severity } from "@foodscanner/shared";
import { HydratedDocument } from "mongoose";

// One source for each list the rule schemas validate against.
export type { Severity };
export const SEVERITIES = severitySchema.options;

export const RULE_OPERATORS = [">", ">=", "<", "<=", "==", "contains"] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

/** Which product form a rule applies to. "any" (default) = solids and liquids. */
export const PRODUCT_FORMS = ["solid", "liquid", "any"] as const;
export type ProductForm = (typeof PRODUCT_FORMS)[number];

@Schema({ _id: false })
export class RuleDefinition {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  field!: string;

  @Prop({ required: true, enum: RULE_OPERATORS })
  operator!: RuleOperator;

  @Prop({ type: Number })
  threshold?: number;

  @Prop({ type: Object })
  value?: unknown;

  @Prop({ required: true, enum: SEVERITIES })
  severity!: Severity;

  @Prop()
  reason?: string;

  /** Short chip text for the app, e.g. "High sugar". */
  @Prop()
  label?: string;

  /** Scopes this rule to solid or liquid products; omitted/"any" = both. */
  @Prop({ enum: PRODUCT_FORMS })
  applies_to?: ProductForm;
}

const RuleDefinitionSchema = SchemaFactory.createForClass(RuleDefinition);

@Schema({ collection: "rule_sets", timestamps: false })
export class RuleSet {
  @Prop({ required: true, unique: true })
  version!: string;

  @Prop({ required: true })
  effective_from!: Date;

  @Prop({ type: Date, default: null })
  effective_to!: Date | null;

  @Prop({ type: [RuleDefinitionSchema], default: [] })
  rules!: RuleDefinition[];
}

export type RuleSetDocument = HydratedDocument<RuleSet>;
export const RuleSetSchema = SchemaFactory.createForClass(RuleSet);
