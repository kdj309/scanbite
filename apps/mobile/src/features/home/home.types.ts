import type { HouseholdMember, Scan } from "@foodscanner/shared";

export interface ScanCardCopy {
  title: string;
  subtitle: string;
}

export interface ScanCardProps extends ScanCardCopy {
  /** Scan for one person; undefined scans for everyone. */
  memberId?: string;
}

export interface ScanForProps {
  checked: readonly HouseholdMember[];
  /** undefined: everyone. */
  selectedId: string | undefined;
  onSelect: (memberId: string | undefined) => void;
}

export interface RecentScansProps {
  members: readonly HouseholdMember[];
  checked: readonly HouseholdMember[];
  /** Removed, waiting out its Undo. */
  hiddenId: string | undefined;
  onRemove: (scan: Scan) => void;
}

export interface FamilyNudgeProps {
  self: HouseholdMember | undefined;
  checked: readonly HouseholdMember[];
}
