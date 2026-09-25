import type { User } from "@foodscanner/shared";
import { toIso } from "../common/dates";
import type { UserDocument } from "../database/schemas/user.schema";

export function serializeUser(user: UserDocument): User {
  return {
    id: user.id as string,
    email: user.email,
    phone: user.phone,
    auth_provider: user.auth_provider,
    default_member_id: user.default_member_id
      ? String(user.default_member_id)
      : "",
    created_at: toIso(user.created_at),
  };
}
