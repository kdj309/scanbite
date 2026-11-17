import type { HouseholdMember, Scan } from "@foodscanner/shared";
import type { ReactNode } from "react";
import type { IconName, VerdictTone } from "@/components";
import type { CheckedVerdict } from "./recent";

export interface VerdictRings {
  shown: CheckedVerdict[];
  more: number;
}

export interface RecentScanRowProps {
  scan: Scan;
  members: readonly HouseholdMember[];
  /** Default: open its result. */
  onPress?: () => void;
  /** Offered to screen readers, which can't swipe the row. */
  onRemove?: () => void;
}

export interface MoreRingProps {
  count: number;
}

export interface SwipeToRemoveProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  /** Read out for the Remove button, e.g. "Remove Delhi mixture". */
  label: string;
  children: ReactNode;
}

export interface UndoBarProps {
  text: string;
  onUndo: () => void;
  /** Distance from the bottom of the screen, e.g. above the tab bar. */
  bottom: number;
}

export interface VerdictRingProps {
  initials?: string;
  icon?: IconName;
  severity: VerdictTone;
  size?: number;
}
