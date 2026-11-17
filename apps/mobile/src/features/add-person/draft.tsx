import { createContext, useContext, useMemo, useState } from "react";
import type { Relationship } from "@foodscanner/shared";
import { newPerson, type DraftPerson } from "./model";
import type { PersonDraftProviderProps } from "./add-person.types";

type Draft = {
  /** The person being set up right now, if any. */
  person: DraftPerson | null;
  start: (relationship: Relationship) => void;
  update: (patch: Partial<DraftPerson>) => void;
  clear: () => void;
};

const DraftContext = createContext<Draft | null>(null);

/** The one person being added, shared by their steps until it's saved. */
export function PersonDraftProvider({ children }: PersonDraftProviderProps) {
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

export function usePersonDraft(): Draft {
  const draft = useContext(DraftContext);
  if (!draft) {
    throw new Error("usePersonDraft needs PersonDraftProvider");
  }
  return draft;
}
