import { z } from "zod";
import { objectIdSchema } from "./primitives";

export const unresolvedTermSchema = z.object({
  id: objectIdSchema,
  raw_string: z.string().min(1),
  occurrence_count: z.number().int().nonnegative(),
  first_seen: z.string(),
  last_seen: z.string(),
  status: z.enum(["pending", "resolved"]),
});
export type UnresolvedTerm = z.infer<typeof unresolvedTermSchema>;

export const listUnresolvedTermsQuerySchema = z.object({
  sort: z.literal("occurrence_count").optional(),
});
export type ListUnresolvedTermsQuery = z.infer<
  typeof listUnresolvedTermsQuerySchema
>;

export const listUnresolvedTermsResponseSchema = z.object({
  items: z.array(unresolvedTermSchema),
});
export type ListUnresolvedTermsResponse = z.infer<
  typeof listUnresolvedTermsResponseSchema
>;

export const newIngredientSchema = z.object({
  canonical_name: z.string().min(1),
  category: z.string().min(1).optional(),
  ins_code: z.string().min(1).optional(),
});
export type NewIngredient = z.infer<typeof newIngredientSchema>;

export const resolveUnresolvedTermRequestSchema = z
  .object({
    canonical_ingredient_id: objectIdSchema.optional(),
    new_ingredient: newIngredientSchema.optional(),
  })
  .refine(
    (body) =>
      Boolean(body.canonical_ingredient_id) !== Boolean(body.new_ingredient),
    {
      message:
        "Provide either canonical_ingredient_id or new_ingredient, not both",
    },
  );
export type ResolveUnresolvedTermRequest = z.infer<
  typeof resolveUnresolvedTermRequestSchema
>;

export const resolveUnresolvedTermResponseSchema = z.object({
  unresolved_term_id: objectIdSchema,
  ingredient_id: objectIdSchema,
});
export type ResolveUnresolvedTermResponse = z.infer<
  typeof resolveUnresolvedTermResponseSchema
>;
