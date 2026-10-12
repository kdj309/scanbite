import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

/** A phone that receives push notifications for an account. */
@Schema({
  collection: "devices",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
})
export class Device {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  user_id!: Types.ObjectId;

  /** Expo push token. One phone = one token; it follows whoever signed in
   *  on that phone last. */
  @Prop({ required: true, unique: true })
  expo_push_token!: string;

  @Prop({ required: true, enum: ["ios", "android"] })
  platform!: "ios" | "android";
}

export type DeviceDocument = HydratedDocument<Device>;
export const DeviceSchema = SchemaFactory.createForClass(Device);
