import type { HouseholdMember } from "@foodscanner/shared";
import {
  addedPeople,
  newPerson,
  saveRequest,
  stepCopy,
  type DraftPerson,
} from "./model";

jest.mock("expo-crypto", () => ({
  randomUUID: () => "6f1c2b9e-4d3a-4c55-9b7e-2a8f0c1d3e4f",
}));

const SELF_ID = "6ab7d04ffb5027914b128aed";
const PAPA_ID = "6ab7d04ffb5027914b128aee";

function member(
  fields: Partial<HouseholdMember> &
    Pick<HouseholdMember, "id" | "relationship">
): HouseholdMember {
  return {
    name: "Self",
    conditions: [],
    allergies: [],
    created_at: "2026-10-17T00:00:00.000Z",
    updated_at: "2026-10-17T00:00:00.000Z",
    ...fields,
  };
}

describe("addedPeople", () => {
  it("lists who's in the family by relationship", () => {
    const added = addedPeople([
      member({ id: SELF_ID, relationship: "self", age_band: "18–39" }),
      member({ id: PAPA_ID, relationship: "parent", name: "Papa" }),
    ]);

    expect(added.get("self")).toEqual([{ id: SELF_ID, name: "You" }]);
    expect(added.get("parent")).toEqual([{ id: PAPA_ID, name: "Papa" }]);
    expect(added.has("spouse")).toBe(false);
  });

  it("doesn't count 'You' until something about you was added", () => {
    expect(
      addedPeople([member({ id: SELF_ID, relationship: "self" })]).size
    ).toBe(0);
  });
});

describe("saveRequest", () => {
  it("updates the existing self member for 'Me', without a name", () => {
    const me: DraftPerson = {
      ...newPerson("self"),
      ageBand: "40–59",
      conditions: ["hypertensive"],
    };

    expect(saveRequest(me, SELF_ID)).toEqual({
      kind: "update",
      id: SELF_ID,
      body: {
        age_band: "40–59",
        conditions: ["hypertensive"],
        allergies: [],
      },
    });
  });

  it("creates anyone else, with their trimmed name, relationship and client id", () => {
    const papa: DraftPerson = {
      ...newPerson("parent"),
      name: "  Papa ",
      allergies: ["peanuts"],
    };

    expect(saveRequest(papa, SELF_ID)).toEqual({
      kind: "create",
      body: {
        name: "Papa",
        relationship: "parent",
        age_band: undefined,
        conditions: [],
        allergies: ["peanuts"],
        client_id: "6f1c2b9e-4d3a-4c55-9b7e-2a8f0c1d3e4f",
      },
    });
  });
});

describe("stepCopy", () => {
  it("speaks to you for 'Me' and uses the name for others", () => {
    expect(stepCopy(newPerson("self")).conditionsTitle).toBe(
      "Do you have any of these?"
    );
    expect(
      stepCopy({ ...newPerson("parent"), name: "Papa" }).conditionsTitle
    ).toBe("Does Papa have any of these?");
  });
});
