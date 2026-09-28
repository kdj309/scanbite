export const MISSING_ACTIVE_RULE_SET =
  "No active rule_set; refusing to score (missing config would otherwise look like green)";

export function requireActiveRuleSet<T>(ruleSet: T | null | undefined): T {
  if (ruleSet == null) {
    throw new Error(MISSING_ACTIVE_RULE_SET);
  }
  return ruleSet;
}
