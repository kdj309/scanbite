import type { HouseholdMember } from "@foodscanner/shared";
import { scanCardCopy } from "./scan-copy";

function member(fields: Partial<HouseholdMember>): HouseholdMember {
  return {
    id: "6ab7d04ffb5027914b128aed",
    name: "Self",
    relationship: "self",
    conditions: [],
    allergies: [],
    created_at: "2026-10-17T00:00:00.000Z",
    updated_at: "2026-10-17T00:00:00.000Z",
    ...fields,
  };
}

const papa = member({
  name: "Papa",
  relationship: "parent",
  conditions: ["diabetic", "hypertensive"],
});

describe("scanCardCopy", () => {
  it("is a plain scan while nobody has conditions", () => {
    expect(scanCardCopy([]).title).toBe("Scan a product");
  });

  it("names the one person and what's checked for them", () => {
    expect(scanCardCopy([papa])).toEqual({
      title: "Scan for Papa",
      subtitle: "Checks Papa's Sugar and BP",
    });
    expect(scanCardCopy([member({ allergies: ["peanuts"] })]).subtitle).toBe(
      "Checks your allergies"
    );
  });

  it("counts a bigger family instead of listing everyone", () => {
    const amma = member({ name: "Amma", relationship: "parent" });
    const riya = member({ name: "Riya", relationship: "child" });
    expect(scanCardCopy([amma, papa, riya]).subtitle).toBe(
      "One scan checks all 3 of you together"
    );
  });

  it("checks everyone together in one scan", () => {
    const amma = member({ name: "Amma", relationship: "parent" });
    expect(scanCardCopy([amma, papa])).toEqual({
      title: "Scan for everyone",
      subtitle: "One scan checks Amma and Papa together",
    });
  });
});
