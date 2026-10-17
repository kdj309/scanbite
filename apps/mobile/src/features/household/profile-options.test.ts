import { toggled } from "./profile-options";

describe("toggled", () => {
  it("adds a missing item and removes a present one", () => {
    expect(toggled(["milk"], "egg")).toEqual(["milk", "egg"]);
    expect(toggled(["milk", "egg"], "milk")).toEqual(["egg"]);
  });
});
