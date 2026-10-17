import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Relationship } from "@foodscanner/shared";
import { newPerson, type DraftPerson } from "./model";

type Draft = {
  /** The person being set up right now, if any. */
  person: DraftPerson | null;
  start: (relationship: Relationship) => void;
  update: (patch: Partial<DraftPerson>) => void;
  clear: () => void;
};

const DraftContext = createContext<Draft | null>(null);

/** The one person being set up, shared by their steps until it's saved. */
export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const [person, setPerson] = useState<DraftPerson | null>(null);

  const value = useMemo<Draft>(
    () => ({
      person,
      start: (relationship) => setPerson(newPerson(relationship)),
      update: (patch) =>
        setPerson((current) => current && { ...current, ...patch }),
      clear: () => setPerson(null),
    }),
    [person]
  );
  return (
    <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
  );
}

export function useOnboardingDraft(): Draft {
  const draft = useContext(DraftContext);
  if (!draft) {
    throw new Error("useOnboardingDraft needs OnboardingDraftProvider");
  }
  return draft;
}
