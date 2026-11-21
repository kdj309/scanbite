/**
 * Household members against real Mongo: a create retried with the same
 * client_id (its response was lost) mustn't add the person twice.
 *
 *   pnpm --filter api build && pnpm --filter api test:integration
 */
import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import {
  HEALTH_CONSENT_NOTICE_VERSION,
  MAX_HOUSEHOLD_MEMBERS,
} from "@foodscanner/shared";
import mongoose from "mongoose";
import { connectTestDb, dropTestDb } from "../common/integration-db";
import {
  HouseholdMember,
  HouseholdMemberSchema,
} from "../database/schemas/household-member.schema";
import { User, UserSchema } from "../database/schemas/user.schema";
import { HouseholdService } from "./household.service";

describe("household members (integration)", () => {
  const members = mongoose.model(HouseholdMember.name, HouseholdMemberSchema);
  const users = mongoose.model(User.name, UserSchema);
  const household = new HouseholdService(members as never, users as never);

  before(() => connectTestDb("itest_household"));
  after(() => dropTestDb());

  /** An account that agreed to the health-info notice (design 0b). */
  const owner = async (consented = true) => {
    const user = await users.create({
      health_consent: consented
        ? {
            notice_version: HEALTH_CONSENT_NOTICE_VERSION,
            agreed_at: new Date(),
          }
        : null,
    });
    return user.id as string;
  };
  const papa = {
    name: "Papa",
    relationship: "parent" as const,
    conditions: ["diabetic" as const],
    consent_basis: "member_agreed" as const,
  };

  it("a retried create updates the member it already made", async () => {
    const userId = await owner();
    const clientId = randomUUID();

    const first = await household.createForUser(userId, {
      ...papa,
      client_id: clientId,
    });
    // The retry carries an edit made after the first attempt "failed".
    const retry = await household.createForUser(userId, {
      ...papa,
      client_id: clientId,
      allergies: ["peanuts"],
    });

    assert.equal(retry.id, first.id);
    assert.deepEqual(retry.allergies, ["peanuts"]);
    assert.equal((await household.listForUser(userId)).members.length, 1);
  });

  it("two retries arriving together still make one member", async () => {
    const userId = await owner();
    const body = { ...papa, client_id: randomUUID() };

    const [a, b] = await Promise.all([
      household.createForUser(userId, body),
      household.createForUser(userId, body),
    ]);

    assert.equal(a.id, b.id);
    assert.equal((await household.listForUser(userId)).members.length, 1);
  });

  it("the same client_id in another account is a different person", async () => {
    const clientId = randomUUID();

    const mine = await household.createForUser(await owner(), {
      ...papa,
      client_id: clientId,
    });
    const theirs = await household.createForUser(await owner(), {
      ...papa,
      client_id: clientId,
    });

    assert.notEqual(mine.id, theirs.id);
  });

  it("creates without a client_id are separate people, as before", async () => {
    const userId = await owner();

    await household.createForUser(userId, papa);
    await household.createForUser(userId, papa);

    assert.equal((await household.listForUser(userId)).members.length, 2);
  });

  it("refuses a seventh person, but still takes a retry of someone saved", async () => {
    const userId = await owner();
    const lastClientId = randomUUID();
    for (let i = 1; i < MAX_HOUSEHOLD_MEMBERS; i++) {
      await household.createForUser(userId, {
        ...papa,
        client_id: randomUUID(),
      });
    }
    await household.createForUser(userId, {
      ...papa,
      client_id: lastClientId,
    });

    await assert.rejects(
      household.createForUser(userId, { ...papa, client_id: randomUUID() }),
      { status: 409 }
    );
    const retry = await household.createForUser(userId, {
      ...papa,
      client_id: lastClientId,
    });
    assert.ok(retry.id);
    assert.equal(
      (await household.listForUser(userId)).members.length,
      MAX_HOUSEHOLD_MEMBERS
    );
  });

  describe("consent (design 0b, 8c)", () => {
    it("won't save anyone's details before you agree to the notice", async () => {
      const userId = await owner(false);
      await assert.rejects(
        household.createForUser(userId, papa),
        (error: { getResponse(): { code: string } }) =>
          error.getResponse().code === "health_consent_required"
      );
    });

    it("won't take your own conditions before you agree either", async () => {
      const userId = await owner(false);
      await assert.rejects(
        household.createForUser(userId, {
          name: "You",
          relationship: "self",
          conditions: ["diabetic"],
        }),
        /health info/i
      );
    });

    it("needs a reason to hold someone else's details, even with none picked", async () => {
      const userId = await owner();
      await assert.rejects(
        household.createForUser(userId, {
          name: "Aarav",
          relationship: "child",
        }),
        /consent_basis/
      );
    });

    it("keeps the reason given with the person", async () => {
      const userId = await owner();
      const aarav = await household.createForUser(userId, {
        name: "Aarav",
        relationship: "child",
        age_band: "0–12",
        consent_basis: "guardian",
      });
      const stored = await members.findById(aarav.id).lean();
      assert.equal(stored?.consent?.basis, "guardian");
      assert.ok(stored?.consent?.given_at instanceof Date);
    });

    it("won't add a second you: that would be someone else, unconsented", async () => {
      const userId = await owner();
      await members.create({
        owner_user_id: userId,
        name: "You",
        relationship: "self",
      });
      await assert.rejects(
        household.createForUser(userId, {
          name: "Aarav",
          relationship: "self",
        }),
        /already in the family/
      );
    });

    it("keeps the time consent was first given when a save is retried", async () => {
      const userId = await owner();
      const body = { ...papa, client_id: randomUUID() };
      const first = await household.createForUser(userId, body);
      const given = (await members.findById(first.id).lean())?.consent
        ?.given_at;
      await new Promise((resolve) => setTimeout(resolve, 20));
      await household.createForUser(userId, {
        ...body,
        allergies: ["peanuts"],
      });
      const after = (await members.findById(first.id).lean())?.consent
        ?.given_at;
      assert.equal(after?.getTime(), given?.getTime());
    });

    it("asks again when the notice has changed", async () => {
      const user = await users.create({
        health_consent: { notice_version: "2020-01-01", agreed_at: new Date() },
      });
      await assert.rejects(
        household.createForUser(user.id as string, papa),
        /health info/i
      );
    });
  });
});
