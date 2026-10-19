import { Avatar } from "@/components";
import { relationshipTints } from "@/theme";
import type { WHO_OPTIONS } from "./model";

/** The circle on a "who" tile: the relationship's own mark and tint. */
export function OptionAvatar({
  option,
}: {
  option: (typeof WHO_OPTIONS)[number];
}) {
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
