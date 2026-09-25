import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

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

  created_at!: Date;
}

export type ScanDocument = HydratedDocument<Scan>;
export const ScanSchema = SchemaFactory.createForClass(Scan);

ScanSchema.index({ member_id: 1, created_at: -1 });
ScanSchema.index({ barcode: 1, found: 1 });
