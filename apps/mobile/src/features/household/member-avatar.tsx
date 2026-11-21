import type { HouseholdMember } from "@foodscanner/shared";
import { Avatar } from "@/components";
import { relationshipTints } from "@/theme";
import { ownName } from "./members";
import type { MemberAvatarProps } from "./household.types";

/** A family member's circle: their initial ("You" while you're unnamed), in their relationship's tint. */
export function MemberAvatar({ member, size }: MemberAvatarProps) {
  const tint = relationshipTints[member.relationship];
  return (
    <Avatar
      initials={memberInitials(member)}
      size={size}
      background={tint.background}
      color={tint.text}
    />
  );
}

/** Their first initial, or "You" while you're unnamed. */
export function memberInitials(
  member: Pick<HouseholdMember, "relationship" | "name">
): string {
  return ownName(member)?.charAt(0).toUpperCase() ?? "You";
}
