import { Avatar } from "@/components";
import { relationshipTints } from "@/theme";
import type { OptionAvatarProps } from "./add-person.types";

/** The circle on a "who" tile: the relationship's own mark and tint. */
export function OptionAvatar({ option }: OptionAvatarProps) {
  const tint = relationshipTints[option.relationship];
  return (
    <Avatar
      initials={option.initials}
      icon={option.icon}
      size={46}
      background={tint.background}
      color={tint.text}
    />
  );
}
