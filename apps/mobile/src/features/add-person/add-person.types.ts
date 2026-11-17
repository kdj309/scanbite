import type { ReactNode } from "react";
import type { WHO_OPTIONS } from "./model";

export interface PersonDraftProviderProps {
  children: ReactNode;
}

export interface OptionAvatarProps {
  option: (typeof WHO_OPTIONS)[number];
}
