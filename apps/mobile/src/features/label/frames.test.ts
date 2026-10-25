jest.mock("expo-video", () => ({}));
jest.mock("expo-image-manipulator", () => ({}));

import { frameTimes } from "./frames";

describe("frameTimes", () => {
  it("spreads the frames evenly, away from the very start and end", () => {
    expect(frameTimes(12)).toEqual([2, 4, 6, 8, 10]);
  });
});
