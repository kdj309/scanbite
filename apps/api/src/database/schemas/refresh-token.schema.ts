import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export const REFRESH_REVOKED_REASONS = [
  "rotated",
  "logout",
  "reuse_detected",
  "signed_out",
] as const;
export type RefreshRevokedReason = (typeof REFRESH_REVOKED_REASONS)[number];

/**
 * One row per issued refresh token. Only a SHA-256 hash of the token is
 * stored, so a database leak can't be replayed as live sessions.
 *
 * Tokens are single-use: /auth/refresh revokes the presented one and issues
 * a successor. Re-presenting a token rotated within the last minute is a
 * retry and gets a fresh pair; any other reuse means it was copied, and
 * every session for that user is revoked.
 */
@Schema({
  collection: "refresh_tokens",
  timestamps: { createdAt: "created_at", updatedAt: false },
})
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  user_id!: Types.ObjectId;

  @Prop({ required: true })
  token_hash!: string;

  @Prop({ required: true })
  expires_at!: Date;

  @Prop({ type: Date, default: null })
  revoked_at!: Date | null;

  /**
   * Why it was revoked. "rotated" tokens get a short grace period on reuse
   * (a lost response or two parallel refreshes is normal); any other reuse
   * is treated as theft.
   */
  @Prop({
    type: String,
    enum: [...REFRESH_REVOKED_REASONS, null],
    default: null,
  })
  revoked_reason!: RefreshRevokedReason | null;

  created_at!: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ token_hash: 1 }, { unique: true });
RefreshTokenSchema.index({ user_id: 1, revoked_at: 1 });
// Mongo removes rows once they expire; revoked rows stay until then so a
// replayed token is still recognised as reuse rather than as unknown.
RefreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
