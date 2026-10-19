import { z } from "zod";
import { allergenListSchema } from "./allergens";
import { healthConditionListSchema } from "./conditions";
import {
  isoDateTimeSchema,
  objectIdSchema,
  relationshipSchema,
} from "./primitives";

export const householdMemberSchema = z.object({
  id: objectIdSchema,
  name: z.string().min(1),
  relationship: relationshipSchema,
  age_band: z.string().min(1).optional(),
  conditions: healthConditionListSchema.default([]),
  allergies: allergenListSchema.default([]),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type HouseholdMember = z.infer<typeof householdMemberSchema>;

/** Most people one family can have, you included. */
export const MAX_HOUSEHOLD_MEMBERS = 6;

export const createHouseholdMemberRequestSchema = z.object({
  /**
   * The app's own id for this person (a UUID it makes once). Sending the
   * same one again returns the member already created, so retrying a save
   * whose response was lost can't add the person twice.
   */
  client_id: z.string().uuid().optional(),
  name: z.string().min(1),
  relationship: relationshipSchema,
  age_band: z.string().min(1).optional(),
  conditions: healthConditionListSchema.optional(),
  allergies: allergenListSchema.optional(),
});
export type CreateHouseholdMemberRequest = z.infer<
  typeof createHouseholdMemberRequestSchema
>;

export const updateHouseholdMemberRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    relationship: relationshipSchema.optional(),
    age_band: z.string().min(1).nullable().optional(),
    conditions: healthConditionListSchema.optional(),
    allergies: allergenListSchema.optional(),
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
