import type { UserRole } from "../database/schemas/user.schema";

export type JwtPayload = {
  sub: string;
  role: UserRole;
};

export type RequestUser = {
  userId: string;
  role: UserRole;
  defaultMemberId: string | null;
};
