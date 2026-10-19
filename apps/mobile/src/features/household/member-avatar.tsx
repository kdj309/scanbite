import type { HouseholdMember } from "@foodscanner/shared";
import { Avatar } from "@/components";
import { relationshipTints } from "@/theme";
import { ownName } from "./members";

/** A family member's circle: their initial ("You" while you're unnamed), in their relationship's tint. */
export function MemberAvatar({
  member,
  size,
}: {
  member: Pick<HouseholdMember, "relationship" | "name">;
  size?: number;
}) {
  const tint = relationshipTints[member.relationship];
  return (
    <Avatar
      initials={ownName(member)?.charAt(0).toUpperCase() ?? "You"}
      size={size}
      background={tint.background}
      color={tint.text}
    />
  );
}
