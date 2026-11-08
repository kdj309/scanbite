jest.mock("expo-video", () => ({}));
jest.mock("expo-image-manipulator", () => ({}));

import { frameTimes } from "./frames";

describe("frameTimes", () => {
  it("takes one frame from the front, then spreads the rest", () => {
    expect(frameTimes(12)).toEqual([1, 4, 6, 8, 10]);
  });

  it("still covers every side in the shortest video", () => {
    expect(frameTimes(6)).toEqual([1, 2.8, 3.6, 4.4, 5.2]);
  });
});
