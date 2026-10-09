import type { AuthProvider } from "@foodscanner/shared";
import type { User } from "../database/schemas/user.schema";

type Identities = Pick<User, "google_sub" | "apple_sub">;

/**
 * How the account signs in, derived from which identities it has rather
 * than stored (an account can have several, and a stored copy would need
 * keeping in sync). Google is reported when both are linked; "anonymous"
 * means none yet.
 */
export function signInMethod(user: Identities): AuthProvider {
  if (user.google_sub) return "google";
  if (user.apple_sub) return "apple";
  return "anonymous";
}

export function isAnonymous(user: Identities): boolean {
  return signInMethod(user) === "anonymous";
}
