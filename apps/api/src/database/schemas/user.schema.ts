import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type UserRole = "user" | "admin";
export type AuthProvider = "otp" | "password";

@Schema({
  collection: "users",
  timestamps: { createdAt: "created_at", updatedAt: false },
})
export class User {
  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  @Prop({ unique: true, sparse: true, trim: true })
  phone?: string;

  @Prop({ required: true, enum: ["otp", "password"] })
  auth_provider!: AuthProvider;

  @Prop()
  password_hash?: string;

  @Prop()
  otp_code?: string;

  @Prop()
  otp_expires_at?: Date;

  @Prop({ required: true, enum: ["user", "admin"], default: "user" })
  role!: UserRole;

  @Prop({ type: Types.ObjectId, ref: "HouseholdMember" })
  default_member_id?: Types.ObjectId;

  created_at!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
