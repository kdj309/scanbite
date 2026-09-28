import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type RuleOperator = ">" | ">=" | "<" | "<=" | "==" | "contains";
export type Severity = "green" | "yellow" | "red";
/** Which product form a rule applies to. "any" (default) = solids and liquids. */
export type ProductForm = "solid" | "liquid" | "any";

@Schema({ _id: false })
export class RuleDefinition {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  field!: string;

  @Prop({ required: true, enum: [">", ">=", "<", "<=", "==", "contains"] })
  operator!: RuleOperator;

  @Prop({ type: Number })
  threshold?: number;

  @Prop({ type: Object })
  value?: unknown;

  @Prop({ required: true, enum: ["green", "yellow", "red"] })
  severity!: Severity;

  @Prop()
  reason?: string;

  /** Scopes this rule to solid or liquid products; omitted/"any" = both. */
  @Prop({ enum: ["solid", "liquid", "any"] })
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
