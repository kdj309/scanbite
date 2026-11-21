import type { ReactNode } from "react";
import type { IconName } from "@/components";

/**
 * Route params for /consent. `next`: the screen to open after "I agree"
 * (a guarded screen redirected here). `mode: "return"`: go back instead,
 * to a screen that opened this over itself. `setup: "1"`: from first-run
 * setup, where "I don't agree" skips setup.
 */
export type ConsentParams = {
  next?: string;
  mode?: "return";
  setup?: "1";
};

export interface ConsentScreenProps {
  /** The screen that asked for consent, opened after "I agree". */
  next: string;
  /** Go back after "I agree" instead (the asking screen is underneath). */
  returnAfter: boolean;
  /** Asked during first-run setup: declining skips setup. */
  fromSetup: boolean;
}

export interface RequireHealthConsentProps {
  children: ReactNode;
  /** The screen is part of first-run setup. */
  setup?: boolean;
}

/** One line of "What we save, and why" (design 0c). */
export interface SavedItem {
  what: string;
  why: string;
}

/** One of the three promises on the consent screen. */
export interface ConsentPoint {
  icon: IconName;
  text: string;
}
