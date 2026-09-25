import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type Severity = "green" | "yellow" | "red";

@Schema({ _id: false })
export class ScoringBreakdownItem {
  @Prop({ required: true })
  rule_id!: string;

  @Prop({ required: true })
  field!: string;

  @Prop({ type: Object, required: true })
  matched_value!: unknown;

  @Prop({ required: true, enum: ["green", "yellow", "red"] })
  severity!: Severity;

  @Prop({ required: true })
  reason!: string;
}

const ScoringBreakdownItemSchema =
  SchemaFactory.createForClass(ScoringBreakdownItem);

@Schema({
  collection: "scoring_records",
  timestamps: { createdAt: "computed_at", updatedAt: false },
})
export class ScoringRecord {
  @Prop({ type: Types.ObjectId, ref: "ProductVersion", required: true })
  product_version_id!: Types.ObjectId;

  @Prop({ required: true })
  rule_set_version!: string;

  @Prop({ required: true, enum: ["green", "yellow", "red"] })
  severity!: Severity;

  @Prop({ type: [ScoringBreakdownItemSchema], default: [] })
  breakdown!: ScoringBreakdownItem[];

  computed_at!: Date;
}

export type ScoringRecordDocument = HydratedDocument<ScoringRecord>;
export const ScoringRecordSchema = SchemaFactory.createForClass(ScoringRecord);

ScoringRecordSchema.index({ product_version_id: 1, computed_at: -1 });
