import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  MemberVerdict,
  ProductFoundResponse,
  Severity,
} from "@foodscanner/shared";
import { submissionMessage } from "./submission-message";

const member = (
  name: string,
  severity: Severity,
  hasProfile = true
): MemberVerdict => ({
  member_id: "6ab7d04ffb5027914b128aed",
  name,
  has_health_profile: hasProfile,
  verdict: { severity, reasons: [] },
});

const ready = (members: MemberVerdict[], name = "Masala chips") =>
  ({
    found: true,
    product: { name },
    members,
  }) as unknown as ProductFoundResponse;

describe("submissionMessage", () => {
  it("leads with the most affected people, worst first", () => {
    assert.deepEqual(
      submissionMessage(
        "ready",
        ready([
          member("You", "yellow", false),
          member("Amma", "yellow"),
          member("Papa", "red"),
        ])
      ),
      {
        title: "Masala chips is ready",
        body: "Avoid for Papa · Caution for Amma",
      }
    );
  });

  it("caps the names and counts the rest", () => {
    const body = submissionMessage(
      "ready",
      ready([
        member("Papa", "red"),
        member("Amma", "red"),
        member("Dadi", "yellow"),
      ])
    ).body;
    assert.equal(body, "Avoid for Papa · Avoid for Amma · +1 more");
  });

  it("says who it's safe for, never people without a health profile", () => {
    assert.equal(
      submissionMessage(
        "ready",
        ready([
          member("You", "green", false),
          member("Amma", "green"),
          member("Papa", "green"),
        ])
      ).body,
      "Safe for Amma & Papa"
    );
  });

  it("doesn't claim anything when nobody has a health profile", () => {
    assert.equal(
      submissionMessage("ready", ready([member("You", "yellow", false)])).body,
      "Tap to see what's in it."
    );
  });

  it("has plain messages for review and failure", () => {
    assert.match(submissionMessage("needs_review", null).body, /closer look/);
    assert.match(submissionMessage("failed", null).title, /couldn't read/);
  });

  it("stays far under Expo's 4,096-byte limit even for a very long name", () => {
    const message = submissionMessage(
      "ready",
      ready(
        [member("Papa", "red"), member("Amma", "red"), member("Dadi", "red")],
        "X".repeat(5000)
      )
    );
    assert.ok(message.title.length <= 70);
    const payload = JSON.stringify({
      to: "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]",
      ...message,
      data: {
        event: "ready",
        submission_id: "6ab7d04ffb5027914b128aed",
        barcode: "8901234567890",
      },
    });
    assert.ok(Buffer.byteLength(payload) < 1024);
  });
});
