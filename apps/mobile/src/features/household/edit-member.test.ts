import { editRequest, type MemberForm } from "./edit-member";

const form: MemberForm = {
  name: "  Papa ",
  ageBand: "60+",
  conditions: ["diabetic"],
  allergies: ["peanuts"],
};

describe("editRequest", () => {
  it("sends the trimmed name with the profile for anyone else", () => {
    expect(editRequest({ relationship: "parent" }, form)).toEqual({
      name: "Papa",
      age_band: "60+",
      conditions: ["diabetic"],
      allergies: ["peanuts"],
    });
  });

  it("never sends a name for 'You'", () => {
    expect(editRequest({ relationship: "self" }, form)).not.toHaveProperty(
      "name"
    );
  });
});
