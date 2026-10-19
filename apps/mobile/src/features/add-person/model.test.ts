import type { HouseholdMember } from "@foodscanner/shared";
import {
  addedPeople,
  addOptions,
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
    const you = member({
      id: SELF_ID,
      relationship: "self",
      age_band: "18–39",
    });
    const papa = member({ id: PAPA_ID, relationship: "parent", name: "Papa" });

    const added = addedPeople([you, papa]);

    expect(added.get("self")).toEqual([you]);
    expect(added.get("parent")).toEqual([papa]);
    expect(added.has("spouse")).toBe(false);
  });

  it("doesn't count 'You' until something about you was added", () => {
    expect(
      addedPeople([member({ id: SELF_ID, relationship: "self" })]).size
    ).toBe(0);
  });
});

describe("addOptions", () => {
  const relationships = (members: HouseholdMember[]) =>
    addOptions(members).map((option) => option.relationship);

  it("never offers 'Me', and offers Partner only while there's none", () => {
    expect(relationships([])).toEqual(["spouse", "parent", "child", "other"]);
    expect(
      relationships([
        member({ id: PAPA_ID, relationship: "spouse", name: "Priya" }),
      ])
    ).toEqual(["parent", "child", "other"]);
  });

  it("keeps offering Parent, Child and Someone else (there can be several)", () => {
    expect(
      relationships([
        member({ id: PAPA_ID, relationship: "parent", name: "Papa" }),
      ])
    ).toContain("parent");
  });
});

describe("saveRequest", () => {
  it("updates the existing self member for 'Me', with your name only if you gave one", () => {
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
    expect(saveRequest({ ...me, name: " Kartik " }, SELF_ID).body).toEqual(
      expect.objectContaining({ name: "Kartik" })
    );
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
