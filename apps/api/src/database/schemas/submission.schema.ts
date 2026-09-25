import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type SubmissionStatus =
  | "processing"
  | "ready"
  | "needs_review"
  | "failed";

@Schema({
  collection: "submissions",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
})
export class Submission {
  @Prop({ required: true, trim: true })
  barcode!: string;

  @Prop({ required: true })
  photo_hash!: string;

  @Prop({ required: true })
  photo_key!: string;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  user_id!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ["processing", "ready", "needs_review", "failed"],
    default: "processing",
  })
  status!: SubmissionStatus;

  @Prop({ type: Types.ObjectId, ref: "ProductVersion", default: null })
  product_version_id!: Types.ObjectId | null;

  created_at!: Date;
  updated_at!: Date;
}

export type SubmissionDocument = HydratedDocument<Submission>;
export const SubmissionSchema = SchemaFactory.createForClass(Submission);

SubmissionSchema.index({ barcode: 1, photo_hash: 1 }, { unique: true });
