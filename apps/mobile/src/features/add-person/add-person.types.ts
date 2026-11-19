import type { ReactNode } from "react";
import type { Relationship } from "@foodscanner/shared";

export interface PersonDraftProviderProps {
  children: ReactNode;
}

export interface OptionAvatarProps {
  option: WhoOption;
}

/** One "Who do you shop for?" tile. */
export interface WhoOption {
  relationship: Relationship;
  title: string;
  subtitle: string;
  initials?: string;
  icon?: "heart";
}

export interface PermissionTickProps {
  /** "I'm Aarav's parent or guardian" / "Amma has agreed to…". */
  label: string;
  checked: boolean;
  onToggle: () => void;
  /** Next was tapped without it: show why they can't go on yet. */
  asked: boolean;
}
