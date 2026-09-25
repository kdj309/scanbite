import { z } from "zod";
import { isoDateTimeSchema, objectIdSchema, relationshipSchema } from "./primitives";

export const householdMemberSchema = z.object({
  id: objectIdSchema,
  name: z.string().min(1),
  relationship: relationshipSchema,
  age_band: z.string().min(1).optional(),
  conditions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type HouseholdMember = z.infer<typeof householdMemberSchema>;

export const createHouseholdMemberRequestSchema = z.object({
  name: z.string().min(1),
  relationship: relationshipSchema,
  age_band: z.string().min(1).optional(),
  conditions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
});
export type CreateHouseholdMemberRequest = z.infer<
  typeof createHouseholdMemberRequestSchema
>;

export const updateHouseholdMemberRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    relationship: relationshipSchema.optional(),
    age_band: z.string().min(1).nullable().optional(),
    conditions: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });
export type UpdateHouseholdMemberRequest = z.infer<
  typeof updateHouseholdMemberRequestSchema
>;

export const listHouseholdMembersResponseSchema = z.object({
  members: z.array(householdMemberSchema),
});
export type ListHouseholdMembersResponse = z.infer<
  typeof listHouseholdMembersResponseSchema
>;
