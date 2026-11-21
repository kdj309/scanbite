import type { Href } from "expo-router";

/** Where one "add a person" flow's screens live, and where Save leads. */
export type PersonFlow = {
  /** Pick who to add. Also where a step goes if its draft is gone (reload). */
  start: Href;
  about: Href;
  conditions: Href;
  allergies: Href;
  /** Where Save returns to. */
  saved: Href;
};

/** First-run setup: back to "Who do you shop for?" for the next person. */
export const SETUP_FLOW: PersonFlow = {
  start: "/onboarding/who",
  about: "/onboarding/about",
  conditions: "/onboarding/conditions",
  allergies: "/onboarding/allergies",
  saved: "/onboarding/who",
};

/** Family → "Add family member": one person, then back to Family. */
export const ADD_FLOW: PersonFlow = {
  start: "/family/add",
  about: "/family/add/about",
  conditions: "/family/add/conditions",
  allergies: "/family/add/allergies",
  saved: "/family",
};
