import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPushResults } from "./push-results";

describe("classifyPushResults", () => {
  it("sorts Expo's answers into what we do about them", () => {
    const outcome = classifyPushResults([
      { token: "phone-ok", result: { status: "ok", id: "ticket-1" } },
      {
        token: "phone-gone",
        result: {
          status: "error",
          error: "DeviceNotRegistered",
          message: "not registered",
        },
      },
      {
        token: "phone-busy",
        result: {
          status: "error",
          error: "MessageRateExceeded",
          message: "slow down",
        },
      },
      {
        token: "phone-fine",
        result: {
          status: "error",
          error: "InvalidCredentials",
          message: "bad FCM key",
        },
      },
    ]);
    assert.deepEqual(outcome, {
      sent: [{ id: "ticket-1", token: "phone-ok" }],
      deadTokens: ["phone-gone"],
      rateLimited: ["phone-busy"],
      // A credentials problem is ours — the phone's token must survive.
      setupErrors: ["InvalidCredentials: bad FCM key"],
    });
  });

  it("doesn't queue a receipt check for a receipt (no id)", () => {
    assert.deepEqual(
      classifyPushResults([{ token: "phone", result: { status: "ok" } }]).sent,
      []
    );
  });
});
