import { z } from "zod";
import { householdMemberSchema } from "./household";
import { authProviderSchema, isoDateTimeSchema, objectIdSchema } from "./primitives";

export const userSchema = z
  .object({
    id: objectIdSchema,
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    auth_provider: authProviderSchema,
    default_member_id: objectIdSchema,
    created_at: isoDateTimeSchema,
  })
  .refine((user) => Boolean(user.email || user.phone), {
    message: "User must have email or phone",
  });
export type User = z.infer<typeof userSchema>;

export const signupRequestSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    password: z.string().min(8).optional(),
    otp: z.string().min(4).optional(),
  })
  .refine((body) => Boolean(body.email || body.phone), {
    message: "email or phone is required",
  })
  .refine((body) => Boolean(body.password || body.otp), {
    message: "password or otp is required",
  });
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const verifyOtpRequestSchema = z.object({
  phone: z.string().min(1),
  otp: z.string().min(4),
});
export type VerifyOtpRequest = z.infer<typeof verifyOtpRequestSchema>;

export const loginRequestSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    password: z.string().min(8).optional(),
    otp: z.string().min(4).optional(),
  })
  .refine((body) => Boolean(body.email || body.phone), {
    message: "email or phone is required",
  })
  .refine((body) => Boolean(body.password || body.otp), {
    message: "password or otp is required",
  });
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer").default("Bearer"),
  user: userSchema,
});
export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;

export const meResponseSchema = z.object({
  user: userSchema,
  household_members: z.array(householdMemberSchema),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
