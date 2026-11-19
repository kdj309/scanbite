import type { HouseholdMember } from "@foodscanner/shared";
import {
  consentBasis,
  hasPermission,
  permissionText,
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
      permissionFor: "member_agreed",
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
        consent_basis: "member_agreed",
      },
    });
  });
});

describe("consent for someone else's details (design 8c)", () => {
  it("asks a child's parent or guardian, by age or as a Child with no age", () => {
    const aarav: DraftPerson = {
      ...newPerson("child"),
      name: "Aarav",
      ageBand: "0–12",
    };
    expect(consentBasis(aarav)).toBe("guardian");
    expect(permissionText(aarav)).toBe("I'm Aarav's parent or guardian");
    expect(consentBasis({ ...newPerson("child"), name: "Riya" })).toBe(
      "guardian"
    );
  });

  it("asks an adult to have agreed, an adult child included", () => {
    const amma: DraftPerson = {
      ...newPerson("parent"),
      name: "Amma",
      ageBand: "60+",
    };
    expect(consentBasis(amma)).toBe("member_agreed");
    expect(permissionText(amma)).toBe(
      "Amma has agreed to me adding their health info"
    );
    const grown: DraftPerson = {
      ...newPerson("child"),
      name: "Dev",
      ageBand: "18–39",
    };
    expect(consentBasis(grown)).toBe("member_agreed");
  });

  it("starts unticked", () => {
    expect(hasPermission(newPerson("parent"))).toBe(false);
  });

  it("drops the tick when a new age changes what's being confirmed", () => {
    const dev: DraftPerson = {
      ...newPerson("child"),
      name: "Dev",
      ageBand: "18–39",
      permissionFor: "member_agreed",
    };
    expect(hasPermission(dev)).toBe(true);
    const nowAChild = { ...dev, ageBand: "0–12" as const };
    expect(hasPermission(nowAChild)).toBe(false);
    // So the save sends no basis they never confirmed.
    const request = saveRequest(nowAChild, SELF_ID);
    expect(
      request.kind === "create" && request.body.consent_basis
    ).toBeUndefined();
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
