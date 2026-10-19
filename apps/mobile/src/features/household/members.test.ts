import type { HouseholdMember } from "@foodscanner/shared";
import {
  familyProgress,
  hasDetails,
  listName,
  withMember,
  withoutMember,
} from "./members";

const base: HouseholdMember = {
  id: "6ab7d04ffb5027914b128aed",
  name: "Self",
  relationship: "self",
  conditions: [],
  allergies: [],
  created_at: "2026-10-17T00:00:00.000Z",
  updated_at: "2026-10-17T00:00:00.000Z",
};

describe("hasDetails", () => {
  it("is false for 'You' until a name, age, condition or allergy is added", () => {
    expect(hasDetails(base)).toBe(false);
    expect(hasDetails({ ...base, name: "Kartik" })).toBe(true);
    expect(hasDetails({ ...base, age_band: "18–39" })).toBe(true);
    expect(hasDetails({ ...base, allergies: ["milk"] })).toBe(true);
  });

  it("is true for anyone else, who always has a name", () => {
    expect(hasDetails({ ...base, relationship: "parent", name: "Papa" })).toBe(
      true
    );
  });
});

describe("familyProgress", () => {
  it("counts people with a condition or allergy, and names the first without", () => {
    const papa: HouseholdMember = {
      ...base,
      id: "6ab7d04ffb5027914b128aee",
      relationship: "parent",
      name: "Papa",
      conditions: ["diabetic"],
    };
    // Age alone doesn't count: scans have nothing personal to check.
    const you: HouseholdMember = { ...base, age_band: "18–39" };

    expect(familyProgress([you, papa])).toEqual({
      done: 1,
      total: 2,
      next: you,
    });
  });
});

describe("listName", () => {
  it("shows your own name with '(you)', or 'You' while unnamed", () => {
    expect(listName({ relationship: "self", name: "Kartik" })).toBe(
      "Kartik (you)"
    );
    expect(listName({ relationship: "self", name: "Self" })).toBe("You");
    expect(listName({ relationship: "parent", name: "Papa" })).toBe("Papa");
  });
});

describe("withMember and withoutMember", () => {
  const papa: HouseholdMember = {
    ...base,
    id: "6ab7d04ffb5027914b128aee",
    name: "Papa",
    relationship: "parent",
  };

  it("adds someone new, replaces someone saved again, and removes", () => {
    const added = withMember([base], papa);
    expect(added.map((m) => m.name)).toEqual(["Self", "Papa"]);

    const edited = withMember(added, { ...papa, conditions: ["diabetic"] });
    expect(edited).toHaveLength(2);
    expect(edited[1].conditions).toEqual(["diabetic"]);

    expect(withoutMember(edited, papa.id)).toEqual([base]);
  });
});
