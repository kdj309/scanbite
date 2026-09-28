import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import type { Severity } from "./scoring-record.schema";

@Schema({
  collection: "scans",
  timestamps: { createdAt: "created_at", updatedAt: false },
})
export class Scan {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  user_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "HouseholdMember", required: true })
  member_id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  barcode!: string;

  @Prop({ type: Types.ObjectId, ref: "ProductVersion", default: null })
  product_version_id!: Types.ObjectId | null;

  @Prop({ required: true })
  found!: boolean;

  // The personalized verdict actually shown to this member at scan time —
  // an audit record, not a live query. Must not be back-filled from a
  // later, possibly different, scoring_record/rule_set once rules change.
  @Prop({ type: String, enum: ["green", "yellow", "red"], default: null })
  severity!: Severity | null;

  @Prop({ type: String, default: null })
  rule_set_version!: string | null;

  created_at!: Date;
}

export type ScanDocument = HydratedDocument<Scan>;
export const ScanSchema = SchemaFactory.createForClass(Scan);

ScanSchema.index({ member_id: 1, created_at: -1 });
ScanSchema.index({ barcode: 1, found: 1 });
