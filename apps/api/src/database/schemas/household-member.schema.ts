import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  ALLERGEN_CODES,
  HEALTH_CONDITION_CODES,
  type AllergenCode,
  type HealthConditionCode,
} from "@foodscanner/shared";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";

export type Relationship = "self" | "spouse" | "child" | "parent" | "other";

@Schema({
  collection: "household_members",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
})
export class HouseholdMember {
  @Prop({ type: SchemaTypes.ObjectId, ref: "User", required: true })
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

  /** The app's id for this person; makes a retried create a no-op. */
  @Prop()
  client_id?: string;

  created_at!: Date;
  updated_at!: Date;
}

export type HouseholdMemberDocument = HydratedDocument<HouseholdMember>;
export const HouseholdMemberSchema =
  SchemaFactory.createForClass(HouseholdMember);

HouseholdMemberSchema.index({ owner_user_id: 1 });
// One member per app-made id per account. Members created without one
// (the self member, older apps) aren't constrained.
HouseholdMemberSchema.index(
  { owner_user_id: 1, client_id: 1 },
  { unique: true, partialFilterExpression: { client_id: { $type: "string" } } }
);
