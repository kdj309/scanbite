import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  parseAppleNotificationEvent,
  requiresAccountDeletion,
} from "./apple-notifications";

describe("parseAppleNotificationEvent", () => {
  it("parses events sent as a JSON string (Apple's format)", () => {
    const event = parseAppleNotificationEvent({
      events: JSON.stringify({ type: "account-delete", sub: "001.abc" }),
    });
    assert.deepEqual(event, { type: "account-delete", sub: "001.abc" });
    assert.equal(requiresAccountDeletion(event), true);
  });

  it("also accepts events as an object", () => {
    const event = parseAppleNotificationEvent({
      events: { type: "consent-revoked", sub: "001.abc" },
    });
    assert.equal(requiresAccountDeletion(event), true);
  });

  it("does not delete for email relay changes", () => {
    const event = parseAppleNotificationEvent({
      events: JSON.stringify({ type: "email-disabled", sub: "001.abc" }),
    });
    assert.equal(requiresAccountDeletion(event), false);
  });

  it("rejects unknown types and malformed payloads", () => {
    assert.throws(
      () =>
        parseAppleNotificationEvent({
          events: JSON.stringify({ type: "something-new", sub: "x" }),
        }),
      BadRequestException
    );
    assert.throws(
      () => parseAppleNotificationEvent({ events: "{not json" }),
      BadRequestException
    );
    assert.throws(() => parseAppleNotificationEvent({}), BadRequestException);
  });
});
