import { routeForPush } from "./push-route";

describe("routeForPush", () => {
  it("opens a read label check", () => {
    expect(
      routeForPush({ event: "ready", barcode: "", label_check_id: "abc" })
    ).toEqual({ pathname: "/label-check/[id]", params: { id: "abc" } });
  });

  it("opens a new product's verdict", () => {
    expect(routeForPush({ event: "ready", barcode: "8901234567890" })).toEqual({
      pathname: "/product/[barcode]",
      params: { barcode: "8901234567890" },
    });
  });

  it("opens the scanner to try again when the label couldn't be read", () => {
    expect(routeForPush({ event: "failed", barcode: "8901234567890" })).toBe(
      "/scan"
    );
  });

  it("goes Home while it's being looked at, or with nothing to open", () => {
    expect(routeForPush({ event: "needs_review", barcode: "1" })).toBe("/");
    expect(routeForPush({})).toBe("/");
  });
});
