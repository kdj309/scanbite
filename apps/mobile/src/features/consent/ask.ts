import { router } from "expo-router";

/**
 * Opens the consent screen over the current one; "I agree" comes back to
 * it with whatever was being edited still there.
 */
export function askHealthConsent() {
  router.push({ pathname: "/consent", params: { mode: "return" } });
}
