import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  ALLERGEN_CODES,
  HEALTH_CONDITION_CODES,
  type AllergenCode,
  type HealthConditionCode,
} from "@foodscanner/shared";
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

  @Prop({
    type: [{ type: String, enum: [...HEALTH_CONDITION_CODES] }],
    default: [],
  })
  conditions!: HealthConditionCode[];

  @Prop({ type: [{ type: String, enum: ALLERGEN_CODES }], default: [] })
  allergies!: AllergenCode[];

  created_at!: Date;
  updated_at!: Date;
}

export type HouseholdMemberDocument = HydratedDocument<HouseholdMember>;
export const HouseholdMemberSchema =
  SchemaFactory.createForClass(HouseholdMember);

HouseholdMemberSchema.index({ owner_user_id: 1 });
