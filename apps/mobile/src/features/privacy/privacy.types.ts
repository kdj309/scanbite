import type { HealthConsent } from "@foodscanner/shared";

export interface ConsentCardProps {
  /** The agreement on record, or null when they haven't agreed (or withdrew). */
  consent: HealthConsent | null;
}

export interface AccountDeletedProps {
  /** Opens the app as on a new phone. */
  onStartAgain: () => void;
}
