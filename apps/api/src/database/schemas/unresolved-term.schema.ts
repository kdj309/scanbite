import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UnresolvedTermStatus = "pending" | "resolved";

@Schema({ collection: "unresolved_terms", timestamps: false })
export class UnresolvedTerm {
  @Prop({ required: true, unique: true, trim: true })
  raw_string!: string;

  @Prop({ required: true, default: 1 })
  occurrence_count!: number;

  @Prop({ required: true, default: Date.now })
  first_seen!: Date;

  @Prop({ required: true, default: Date.now })
  last_seen!: Date;

  @Prop({ required: true, enum: ["pending", "resolved"], default: "pending" })
  status!: UnresolvedTermStatus;
}

export type UnresolvedTermDocument = HydratedDocument<UnresolvedTerm>;
export const UnresolvedTermSchema = SchemaFactory.createForClass(UnresolvedTerm);

UnresolvedTermSchema.index({ status: 1, occurrence_count: -1 });
