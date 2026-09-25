import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type Relationship = "self" | "spouse" | "child" | "parent" | "other";

@Schema({
  collection: "household_members",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
})
export class HouseholdMember {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  owner_user_id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    required: true,
    enum: ["self", "spouse", "child", "parent", "other"],
  })
  relationship!: Relationship;

  @Prop()
  age_band?: string;

  @Prop({ type: [String], default: [] })
  conditions!: string[];

  @Prop({ type: [String], default: [] })
  allergies!: string[];

  created_at!: Date;
  updated_at!: Date;
}

export type HouseholdMemberDocument = HydratedDocument<HouseholdMember>;
export const HouseholdMemberSchema =
  SchemaFactory.createForClass(HouseholdMember);

HouseholdMemberSchema.index({ owner_user_id: 1 });
