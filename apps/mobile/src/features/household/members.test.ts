import type { HouseholdMember } from "@foodscanner/shared";
import { hasDetails } from "./members";

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
  it("is false for 'You' until an age, condition or allergy is added", () => {
    expect(hasDetails(base)).toBe(false);
    expect(hasDetails({ ...base, age_band: "18–39" })).toBe(true);
    expect(hasDetails({ ...base, allergies: ["milk"] })).toBe(true);
  });

  it("is true for anyone else, who always has a name", () => {
    expect(hasDetails({ ...base, relationship: "parent", name: "Papa" })).toBe(
      true
    );
  });
});
