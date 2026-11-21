/** How a product's refreshed nutrition differs from what's stored, worst first. */
export type RefreshChange =
  /** Sugar or sodium was stored, OFF no longer gives it. */
  | "verdict_fact_lost"
  /** Moved between per 100 g and per 100 ml. */
  | "basis_changed"
  /** Sugar or sodium is still there with a different value. */
  | "verdict_fact_changed"
  /** Sugar and sodium as before, other nutrients added or changed. */
  | "other_facts"
  | "unchanged";
