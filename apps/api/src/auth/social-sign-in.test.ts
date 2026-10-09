import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideSocialSignIn,
  isEmailTrustedForLinking,
  type SignInCandidate,
} from "./social-sign-in";

const anon = (id = "anon1"): SignInCandidate => ({
  id,

  provider_sub: null,
});

describe("decideSocialSignIn", () => {
  it("links the identity to the caller's anonymous account (normal upgrade)", () => {
    const decision = decideSocialSignIn({
      current: anon(),
      bySub: null,
      byVerifiedEmail: null,
    });
    assert.deepEqual(decision, { kind: "link-current", userId: "anon1" });
  });

  it("switches to the account already linked to this identity (reinstall)", () => {
    const decision = decideSocialSignIn({
      current: anon("fresh"),
      bySub: { id: "real" },
      byVerifiedEmail: null,
    });
    assert.deepEqual(decision, {
      kind: "use-existing",
      userId: "real",
      switched: true,
    });
  });

  it("is not a switch when the caller already is the linked account", () => {
    const decision = decideSocialSignIn({
      current: { id: "real", provider_sub: "g-1" },
      bySub: { id: "real" },
      byVerifiedEmail: null,
    });
    assert.deepEqual(decision, {
      kind: "use-existing",
      userId: "real",
      switched: false,
    });
  });

  it("signs in to an existing linked account with no caller token", () => {
    const decision = decideSocialSignIn({
      current: null,
      bySub: { id: "real" },
      byVerifiedEmail: null,
    });
    assert.deepEqual(decision, {
      kind: "use-existing",
      userId: "real",
      switched: false,
    });
  });

  it("attaches to the account that owns the verified email instead of duplicating the person", () => {
    const decision = decideSocialSignIn({
      current: anon(),
      bySub: null,
      byVerifiedEmail: { id: "pw-user", provider_sub: null },
    });
    assert.deepEqual(decision, {
      kind: "use-existing",
      userId: "pw-user",
      switched: true,
    });
  });

  it("refuses when the email's account is linked to a different identity", () => {
    const decision = decideSocialSignIn({
      current: null,
      bySub: null,
      byVerifiedEmail: { id: "pw-user", provider_sub: "g-old" },
    });
    assert.equal(decision.kind, "conflict");
  });

  it("refuses to relink a caller already tied to a different identity of the same provider", () => {
    const decision = decideSocialSignIn({
      current: { id: "u1", provider_sub: "g-old" },
      bySub: null,
      byVerifiedEmail: null,
    });
    assert.equal(decision.kind, "conflict");
  });

  it("creates a new account when there is no caller and no match", () => {
    const decision = decideSocialSignIn({
      current: null,
      bySub: null,
      byVerifiedEmail: null,
    });
    assert.deepEqual(decision, { kind: "create" });
  });

  it("lets an Apple user add Google to the same account (email already theirs)", () => {
    const decision = decideSocialSignIn({
      current: { id: "ap", provider_sub: null },
      bySub: null,
      byVerifiedEmail: { id: "ap", provider_sub: null },
    });
    assert.deepEqual(decision, { kind: "link-current", userId: "ap" });
  });
});

describe("isEmailTrustedForLinking", () => {
  const id = (email: string, hd: string | null = null, verified = true) => ({
    email,
    emailVerified: verified,
    hostedDomain: hd,
  });

  it("trusts verified Gmail addresses", () => {
    assert.equal(
      isEmailTrustedForLinking("google", id("asha@gmail.com")),
      true
    );
    assert.equal(
      isEmailTrustedForLinking("google", id("Asha@GoogleMail.com")),
      true
    );
  });

  it("trusts Google Workspace accounts (hd claim)", () => {
    assert.equal(
      isEmailTrustedForLinking("google", id("asha@company.in", "company.in")),
      true
    );
  });

  it("does not trust other domains on a consumer Google account", () => {
    assert.equal(
      isEmailTrustedForLinking("google", id("asha@yahoo.com")),
      false
    );
  });

  it("does not trust unverified emails", () => {
    assert.equal(
      isEmailTrustedForLinking("google", id("asha@gmail.com", null, false)),
      false
    );
  });

  it("never links by Apple email", () => {
    assert.equal(
      isEmailTrustedForLinking("apple", id("asha@gmail.com")),
      false
    );
  });
});
