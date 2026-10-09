/**
 * Integration tests for the auth flows against real Mongo + Redis (CI starts
 * both as service containers; locally `docker compose up -d`). Google/Apple
 * token checks, Apple's REST API and object storage are faked — they need
 * real credentials. Uses its own `foodscanner_test` database, dropped after.
 *
 *   pnpm --filter api build && pnpm --filter api test:integration
 */
import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { JWTPayload } from "jose";
import mongoose, { Types } from "mongoose";
import { RedisCacheService } from "../common/redis-cache.service";
import { decryptSecret } from "../common/secret-box";
import {
  HouseholdMember,
  HouseholdMemberSchema,
} from "../database/schemas/household-member.schema";
import {
  RefreshToken,
  RefreshTokenSchema,
} from "../database/schemas/refresh-token.schema";
import { Scan, ScanSchema } from "../database/schemas/scan.schema";
import {
  Submission,
  SubmissionSchema,
} from "../database/schemas/submission.schema";
import { User, UserSchema } from "../database/schemas/user.schema";
import { HouseholdService } from "../household/household.service";
import { AccountService } from "./account.service";
import { AppleCredentials } from "./apple/apple-credentials";
import { AppleNotificationService } from "./apple/apple-notification.service";
import { AppleTokenClient } from "./apple/apple-token-client";
import { IdTokenVerifier, type VerifiedIdentity } from "./id-token-verifier";
import { SessionService } from "./session.service";
import type { SocialProvider } from "./social-sign-in";
import { SocialSignInService } from "./social-sign-in.service";

const MONGO_URI =
  process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27018/foodscanner_test";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const ENCRYPTION_KEY = randomBytes(32);
const ADMIN = "admin@gmail.com";

/** The "ID token" is a JSON-encoded identity. */
class FakeVerifier extends IdTokenVerifier {
  async verify(
    _provider: SocialProvider,
    token: string,
    _rawNonce: string
  ): Promise<VerifiedIdentity> {
    return {
      audience: "in.scanbite.app",
      hostedDomain: null,
      email: null,
      emailVerified: false,
      ...(JSON.parse(token) as Partial<VerifiedIdentity>),
    } as VerifiedIdentity;
  }
  async verifyAppleNotification(payload: string): Promise<JWTPayload> {
    return JSON.parse(payload) as JWTPayload;
  }
}

class FakeApple extends AppleTokenClient {
  revoked: Array<{ token: string; clientId: string }> = [];
  async exchangeCode(code: string): Promise<string> {
    return `apple-refresh-for-${code}`;
  }
  async revoke(token: string, clientId: string): Promise<void> {
    this.revoked.push({ token, clientId });
  }
}

class FakeStorage {
  deleted: string[] = [];
  async deleteLabelPhoto(key: string): Promise<void> {
    this.deleted.push(key);
  }
}

const oid = (id: string) => new Types.ObjectId(id);
let seq = 0;
const nonce = () => `test-nonce-${Date.now()}-${seq++}-padding`;
const googleToken = (sub: string, email: string | null = null) =>
  JSON.stringify({ sub, email, emailVerified: Boolean(email) });
const appleToken = (sub: string, email: string | null = null) =>
  JSON.stringify({ sub, email, emailVerified: Boolean(email) });

describe("auth (integration)", () => {
  const apple = new FakeApple();
  const storage = new FakeStorage();
  const verifier = new FakeVerifier();
  const config = new ConfigService({
    JWT_SECRET: "integration-test-secret-1234",
    REFRESH_TOKEN_TTL_DAYS: 180,
    TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY,
    ADMIN_EMAIL: ADMIN,
    REDIS_URL,
  });
  const redis = new RedisCacheService(config as never);
  const users = mongoose.model(User.name, UserSchema);
  const members = mongoose.model(HouseholdMember.name, HouseholdMemberSchema);
  const refreshTokens = mongoose.model(RefreshToken.name, RefreshTokenSchema);
  const scans = mongoose.model(Scan.name, ScanSchema);
  const submissions = mongoose.model(Submission.name, SubmissionSchema);

  const household = new HouseholdService(members as never, users as never);
  const sessions = new SessionService(
    new JwtService({
      secret: "integration-test-secret-1234",
      signOptions: { expiresIn: "15m" },
    }),
    config as never,
    refreshTokens as never,
    users as never
  );
  const appleCredentials = new AppleCredentials(apple, config as never);
  const accounts = new AccountService(
    mongoose.connection,
    users as never,
    members as never,
    scans as never,
    submissions as never,
    household,
    storage as never,
    sessions,
    appleCredentials
  );
  const signIn = new SocialSignInService(
    config as never,
    users as never,
    verifier,
    redis,
    appleCredentials,
    accounts,
    sessions
  );
  const notifications = new AppleNotificationService(
    verifier,
    users as never,
    accounts,
    sessions,
    appleCredentials
  );

  const setSelf = (
    account: { user: { id: string; default_member_id: string } },
    patch: object
  ) =>
    household.updateForUser(
      account.user.id,
      account.user.default_member_id,
      patch as never
    );

  before(async () => {
    await mongoose.connect(MONGO_URI);
    await mongoose.connection.dropDatabase();
    // Dropping removes the indexes too; the unique ones are part of what's tested.
    await Promise.all(
      [users, members, refreshTokens, scans, submissions].map((m) =>
        m.syncIndexes()
      )
    );
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await redis.client.quit();
  });

  describe("linking", () => {
    it("upgrades an anonymous account to Google, keeping its family", async () => {
      const anon = await accounts.createAnonymous();
      await setSelf(anon, { conditions: ["diabetic"] });
      const linked = await signIn.signIn(
        "google",
        googleToken("g-link", "link@gmail.com"),
        nonce(),
        anon.user.id
      );
      assert.equal(linked.user.id, anon.user.id);
      assert.equal(linked.user.auth_provider, "google");
      const me = await accounts.me(linked.user.id);
      assert.deepEqual(me.household_members[0].conditions, ["diabetic"]);
      assert.equal(
        (await users.findById(anon.user.id).lean())?.email_verified,
        true
      );
    });

    it("switches back after a reinstall and deletes the empty throwaway", async () => {
      const original = await accounts.createAnonymous();
      await signIn.signIn(
        "google",
        googleToken("g-re"),
        nonce(),
        original.user.id
      );
      const fresh = await accounts.createAnonymous();
      const again = await signIn.signIn(
        "google",
        googleToken("g-re"),
        nonce(),
        fresh.user.id
      );
      assert.equal(again.user.id, original.user.id);
      assert.equal(again.account_switched, true);
      assert.equal(await users.exists({ _id: fresh.user.id }), null);
    });

    it("keeps a throwaway that has family data or uploaded label photos", async () => {
      const original = await accounts.createAnonymous();
      await signIn.signIn(
        "google",
        googleToken("g-keep"),
        nonce(),
        original.user.id
      );

      const withFamily = await accounts.createAnonymous();
      await setSelf(withFamily, { allergies: ["peanuts"] });
      await signIn.signIn(
        "google",
        googleToken("g-keep"),
        nonce(),
        withFamily.user.id
      );
      assert.ok(await users.exists({ _id: withFamily.user.id }));

      const withPhotos = await accounts.createAnonymous();
      await submissions.create({
        barcode: "8900000000001",
        photo_hash: "h-keep",
        photo_keys: ["labels/keep.jpg"],
        user_id: oid(withPhotos.user.id),
      });
      await signIn.signIn(
        "google",
        googleToken("g-keep"),
        nonce(),
        withPhotos.user.id
      );
      assert.ok(await users.exists({ _id: withPhotos.user.id }));
      assert.ok(await submissions.exists({ user_id: oid(withPhotos.user.id) }));
    });

    it("never routes a Google sign-in into an account that merely holds that Gmail", async () => {
      // Apple emails are stored unverified, so they can't be matched.
      const holder = await signIn.signIn(
        "apple",
        appleToken("ap-holder", "victim@gmail.com"),
        nonce(),
        null,
        { appleAuthorizationCode: "code-holder" }
      );
      assert.equal(
        (await users.findById(holder.user.id).lean())?.email_verified,
        false
      );
      const victim = await signIn.signIn(
        "google",
        googleToken("g-victim", "victim@gmail.com"),
        nonce(),
        null
      );
      assert.notEqual(victim.user.id, holder.user.id);
    });

    it("grants admin only when ADMIN_EMAIL is proven through Google", async () => {
      const viaApple = await signIn.signIn(
        "apple",
        appleToken("ap-admin", ADMIN),
        nonce(),
        null,
        { appleAuthorizationCode: "code-admin" }
      );
      assert.equal(
        (await users.findById(viaApple.user.id).lean())?.role,
        "user"
      );
      const viaGoogle = await signIn.signIn(
        "google",
        googleToken("g-admin", ADMIN),
        nonce(),
        null
      );
      assert.equal(
        (await users.findById(viaGoogle.user.id).lean())?.role,
        "admin"
      );
    });

    it("rejects a replayed nonce", async () => {
      const once = nonce();
      await signIn.signIn("google", googleToken("g-nonce"), once, null);
      await assert.rejects(
        signIn.signIn("google", googleToken("g-nonce"), once, null)
      );
    });
  });

  describe("apple", () => {
    it("stores Apple's refresh token encrypted and names the Self member", async () => {
      const anon = await accounts.createAnonymous();
      const signedIn = await signIn.signIn(
        "apple",
        appleToken("ap-name"),
        nonce(),
        anon.user.id,
        { appleAuthorizationCode: "code-name", givenName: "Kartik" }
      );
      const user = await users.findById(signedIn.user.id).lean();
      assert.equal(
        decryptSecret(user!.apple_refresh_token_enc!, ENCRYPTION_KEY),
        "apple-refresh-for-code-name"
      );
      assert.equal(user!.apple_client_id, "in.scanbite.app");
      const me = await accounts.me(signedIn.user.id);
      assert.equal(me.household_members[0].name, "Kartik");
    });

    it("rejects Apple sign-in without an authorization code", async () => {
      await assert.rejects(
        signIn.signIn("apple", appleToken("ap-nocode"), nonce(), null)
      );
    });

    it("account-delete removes an Apple-only account", async () => {
      const account = await signIn.signIn(
        "apple",
        appleToken("ap-gone"),
        nonce(),
        null,
        { appleAuthorizationCode: "code-gone" }
      );
      await notifications.handle(
        JSON.stringify({
          events: JSON.stringify({ type: "account-delete", sub: "ap-gone" }),
        })
      );
      assert.equal(await users.exists({ _id: account.user.id }), null);
    });

    it("consent-revoked detaches Apple but keeps an account that has Google", async () => {
      const account = await signIn.signIn(
        "apple",
        appleToken("ap-both"),
        nonce(),
        null,
        { appleAuthorizationCode: "code-both" }
      );
      await signIn.signIn(
        "google",
        googleToken("g-both"),
        nonce(),
        account.user.id
      );
      await notifications.handle(
        JSON.stringify({
          events: JSON.stringify({ type: "consent-revoked", sub: "ap-both" }),
        })
      );
      const user = await users.findById(account.user.id).lean();
      assert.ok(user);
      assert.equal(user.apple_sub, undefined);
      await assert.rejects(sessions.refresh(account.refresh_token));
    });
  });

  describe("account deletion", () => {
    it("revokes Apple and removes the user and everything tied to it", async () => {
      const account = await signIn.signIn(
        "apple",
        appleToken("ap-del"),
        nonce(),
        null,
        { appleAuthorizationCode: "code-del" }
      );
      const userId = oid(account.user.id);
      await scans.create({
        user_id: userId,
        member_id: oid(account.user.default_member_id),
        barcode: "8900000000000",
        found: false,
      });
      await submissions.create({
        barcode: "8900000000002",
        photo_hash: "h-del",
        photo_keys: ["labels/del.jpg"],
        user_id: userId,
      });

      await accounts.delete(account.user.id);

      assert.equal(await users.exists({ _id: userId }), null);
      assert.equal(await members.exists({ owner_user_id: userId }), null);
      assert.equal(await scans.exists({ user_id: userId }), null);
      assert.equal(await submissions.exists({ user_id: userId }), null);
      assert.equal(await refreshTokens.exists({ user_id: userId }), null);
      assert.ok(
        apple.revoked.some(
          (r) =>
            r.token === "apple-refresh-for-code-del" &&
            r.clientId === "in.scanbite.app"
        )
      );
      assert.ok(storage.deleted.includes("labels/del.jpg"));
    });
  });

  describe("sessions", () => {
    it("rotates refresh tokens and tolerates a retry within the grace window", async () => {
      const account = await accounts.createAnonymous();
      const first = await sessions.refresh(account.refresh_token);
      const retry = await sessions.refresh(account.refresh_token);
      assert.equal(retry.user.id, account.user.id);
      assert.ok((await sessions.refresh(first.refresh_token)).access_token);
    });

    it("treats reuse after the grace window as theft and revokes every session", async () => {
      const account = await accounts.createAnonymous();
      const next = await sessions.refresh(account.refresh_token);
      await refreshTokens.updateMany(
        { user_id: oid(account.user.id), revoked_reason: "rotated" },
        { $set: { revoked_at: new Date(Date.now() - 5 * 60 * 1000) } }
      );
      await assert.rejects(sessions.refresh(account.refresh_token));
      await assert.rejects(sessions.refresh(next.refresh_token));
    });

    it("logout ends just that session; a late refresh doesn't sign out other devices", async () => {
      const phone = await accounts.createAnonymous();
      const tablet = await sessions.issue(
        await users.findById(phone.user.id).orFail()
      );
      await sessions.logout(phone.refresh_token);
      await assert.rejects(sessions.refresh(phone.refresh_token));
      assert.ok((await sessions.refresh(tablet.refresh_token)).access_token);
    });
  });
});
