import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Schema({
  collection: "users",
  timestamps: { createdAt: "created_at", updatedAt: false },
})
export class User {
  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  /**
   * True only when `email` came from a provider that is authoritative for
   * it (Gmail / Google Workspace). Emails from Apple, or from Google for
   * other domains, are stored unverified. Only verified emails can route a
   * Google sign-in to an existing account, so an address that merely ended
   * up on someone's account can't pull another person's sign-in into it.
   */
  @Prop({ default: false })
  email_verified!: boolean;

  /** Google's stable account id (`sub` claim) — never the email. */
  @Prop({ unique: true, sparse: true })
  google_sub?: string;

  /** Apple's stable account id (`sub` claim). */
  @Prop({ unique: true, sparse: true })
  apple_sub?: string;

  /**
   * Apple refresh token from the authorization-code exchange, encrypted at
   * rest (AES-256-GCM, TOKEN_ENCRYPTION_KEY). Kept only so account deletion
   * can revoke it at Apple's /auth/revoke, as Apple requires.
   */
  @Prop()
  apple_refresh_token_enc?: string;

  /** Which Apple client id (bundle id / Services ID) issued that token. */
  @Prop()
  apple_client_id?: string;

  @Prop({ required: true, enum: USER_ROLES, default: "user" })
  role!: UserRole;

  @Prop({ type: Types.ObjectId, ref: "HouseholdMember" })
  default_member_id?: Types.ObjectId;

  created_at!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
