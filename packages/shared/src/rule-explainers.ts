import { z } from "zod";
import { objectIdSchema } from "./primitives";

export const listRuleExplainersQuerySchema = z.object({
  ids: z.string().min(1),
  member_id: objectIdSchema.optional(),
});
export type ListRuleExplainersQuery = z.infer<
  typeof listRuleExplainersQuerySchema
>;

export const ruleExplainerItemSchema = z.object({
  rule_ids: z.array(z.string()),
  title: z.string(),
  explainer: z.string(),
  addendum: z.string().nullable(),
  citations: z.string(),
});
export type RuleExplainerItem = z.infer<typeof ruleExplainerItemSchema>;

export const listRuleExplainersResponseSchema = z.object({
  items: z.array(ruleExplainerItemSchema),
});
export type ListRuleExplainersResponse = z.infer<
  typeof listRuleExplainersResponseSchema
>;
