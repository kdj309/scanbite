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
