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
import { MAX_HOUSEHOLD_MEMBERS } from "@foodscanner/shared";
import mongoose, { Types } from "mongoose";
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

  const owner = () => new Types.ObjectId().toString();
  const papa = {
    name: "Papa",
    relationship: "parent" as const,
    conditions: ["diabetic" as const],
  };

  it("a retried create updates the member it already made", async () => {
    const userId = owner();
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
    const userId = owner();
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

    const mine = await household.createForUser(owner(), {
      ...papa,
      client_id: clientId,
    });
    const theirs = await household.createForUser(owner(), {
      ...papa,
      client_id: clientId,
    });

    assert.notEqual(mine.id, theirs.id);
  });

  it("creates without a client_id are separate people, as before", async () => {
    const userId = owner();

    await household.createForUser(userId, papa);
    await household.createForUser(userId, papa);

    assert.equal((await household.listForUser(userId)).members.length, 2);
  });

  it("refuses a seventh person, but still takes a retry of someone saved", async () => {
    const userId = owner();
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
});
