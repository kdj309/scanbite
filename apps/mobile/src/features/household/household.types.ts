import type { HouseholdMember, Relationship } from "@foodscanner/shared";
import type { useHousehold } from "./api";
import type { AgeBand } from "./profile-options";

export interface FamilyProgress {
  done: number;
  total: number;
  /** The first person with nothing to check yet, if any. */
  next: HouseholdMember | undefined;
}

export interface MemberCardProps {
  member: HouseholdMember;
}

export interface AddConditionsChipProps {
  /** For screen readers: who it's for. */
  label: string;
  onPress: () => void;
}

export type ProgressRingProps = Pick<FamilyProgress, "done" | "total">;

export interface EditFormProps {
  member: HouseholdMember;
}

export interface HouseholdLoadingProps {
  household: ReturnType<typeof useHousehold>;
}

export interface MemberAvatarProps {
  member: Pick<HouseholdMember, "relationship" | "name">;
  size?: number;
}

export interface NameFieldProps {
  relationship: Relationship;
  value: string;
  onChange: (name: string) => void;
}

export interface AgePickerProps {
  value: AgeBand | undefined;
  onChange: (value: AgeBand) => void;
}
