import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAnonymous, signInMethod } from "./sign-in-method";

describe("signInMethod", () => {
  it("is anonymous until an identity is linked", () => {
    assert.equal(signInMethod({}), "anonymous");
    assert.equal(isAnonymous({}), true);
  });

  it("reports the linked identity, Google first when both are linked", () => {
    assert.equal(signInMethod({ apple_sub: "a" }), "apple");
    assert.equal(signInMethod({ google_sub: "g", apple_sub: "a" }), "google");
    assert.equal(isAnonymous({ google_sub: "g" }), false);
  });
});
