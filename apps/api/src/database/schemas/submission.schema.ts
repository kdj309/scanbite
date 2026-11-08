import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import {
  VersionIngredient,
  VersionIngredientSchema,
} from "./product-version.schema";

export type SubmissionStatus =
  "processing" | "ready" | "needs_review" | "failed";

/** What a label check's photos said. Kept on the submission itself, never
 *  as a product version, so it can't reach the shared catalog. */
@Schema({ _id: false })
export class LabelFacts {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  brand!: string;

  @Prop({ required: true, trim: true })
  category!: string;

  @Prop({ type: [VersionIngredientSchema], default: [] })
  ingredients!: VersionIngredient[];

  @Prop({ type: Object, default: {} })
  nutrition!: Record<string, number | string | null>;

  @Prop({ type: Number })
  nova_group?: number;

  @Prop({ type: Number })
  additive_count?: number;
}

const LabelFactsSchema = SchemaFactory.createForClass(LabelFacts);

@Schema({
  collection: "submissions",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
})
export class Submission {
  /** null = a label check: a pack with no barcode, read for this user only. */
  @Prop({ type: String, trim: true, default: null })
  barcode!: string | null;

  /** Hash of the sorted individual photo hashes — identifies this exact photo set for dedup. */
  @Prop({ required: true })
  photo_hash!: string;

  @Prop({ required: true, type: [String] })
  photo_keys!: string[];

  @Prop({ type: SchemaTypes.ObjectId, ref: "User", required: true })
  user_id!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ["processing", "ready", "needs_review", "failed"],
    default: "processing",
  })
  status!: SubmissionStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: "ProductVersion", default: null })
  product_version_id!: Types.ObjectId | null;

  /** Label checks only: who it's checked for; null = everyone. */
  @Prop({ type: SchemaTypes.ObjectId, ref: "HouseholdMember", default: null })
  for_member_id!: Types.ObjectId | null;

  /** Label checks only, once read. */
  @Prop({ type: LabelFactsSchema, default: null })
  label_facts!: LabelFacts | null;

  created_at!: Date;
  updated_at!: Date;
}

export type SubmissionDocument = HydratedDocument<Submission>;
export const SubmissionSchema = SchemaFactory.createForClass(Submission);

// The same photos for a product are one submission, whoever sends them; a
// label check's photos are only the same check for the same person.
SubmissionSchema.index(
  { barcode: 1, photo_hash: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: "string" } } }
);
SubmissionSchema.index(
  { user_id: 1, photo_hash: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: "null" } } }
);
