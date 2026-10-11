/**
 * Push notifications against real Mongo + Redis: device registration, the
 * message a finished submission sends (with the household verdict), and
 * cleanup of dead tokens from tickets and receipts. Expo is replaced by a
 * scripted fake; receipt-check jobs are captured instead of queued.
 *
 *   pnpm --filter api build && pnpm --filter api test:integration
 */
import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import mongoose, { Types } from "mongoose";
import {
  TEST_REDIS_URL,
  connectTestDb,
  dropTestDb,
} from "../common/integration-db";
import { RedisCacheService } from "../common/redis-cache.service";
import { VerdictCacheService } from "../common/verdict-cache.service";
import { Device, DeviceSchema } from "../database/schemas/device.schema";
import {
  HouseholdMember,
  HouseholdMemberSchema,
} from "../database/schemas/household-member.schema";
import {
  Ingredient,
  IngredientSchema,
} from "../database/schemas/ingredient.schema";
import {
  PersonalizationRule,
  PersonalizationRuleSchema,
} from "../database/schemas/personalization-rule.schema";
import {
  ProductVersion,
  ProductVersionSchema,
} from "../database/schemas/product-version.schema";
import { RuleSet, RuleSetSchema } from "../database/schemas/rule-set.schema";
import {
  ScoringRecord,
  ScoringRecordSchema,
} from "../database/schemas/scoring-record.schema";
import {
  Submission,
  SubmissionSchema,
} from "../database/schemas/submission.schema";
import { User, UserSchema } from "../database/schemas/user.schema";
import { DevicesService } from "../devices/devices.service";
import { HouseholdService } from "../household/household.service";
import { HouseholdVerdictService } from "../personalization/household-verdict.service";
import { PersonalizationService } from "../personalization/personalization.service";
import { ProductSummaryService } from "../product-versions/product-summary";
import { ScoringService } from "../scoring/scoring.service";
import {
  HLD_PERSONALIZATION_SEEDS,
  HLD_RULE_SET_SEED,
} from "../workers/seed/hld-seed";
import type { CheckPushReceiptsJobData } from "../workers/queue-names";
import { PushNotifier } from "./push-notifier";
import { PushSender, type PushMessage, type PushResult } from "./push-sender";

/** Answers each message with the next scripted result (default: ok). */
class FakePushSender extends PushSender {
  sent: PushMessage[] = [];
  ticketFor = new Map<string, PushResult>();
  receiptFor = new Map<string, PushResult>();
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    this.sent.push(...messages);
    return messages.map(
      (m) => this.ticketFor.get(m.to) ?? { status: "ok", id: `ticket-${m.to}` }
    );
  }
  async receipts(ids: string[]): Promise<Record<string, PushResult>> {
    return Object.fromEntries(
      ids.flatMap((id) => {
        const receipt = this.receiptFor.get(id);
        return receipt ? [[id, receipt]] : [];
      })
    );
  }
}

const token = (name: string) => `ExponentPushToken[${name}]`;

describe("push notifications (integration)", () => {
  const config = new ConfigService({
    REDIS_URL: TEST_REDIS_URL,
    VERDICT_CACHE_TTL_SECONDS: 60,
  });
  const redis = new RedisCacheService(config as never);
  const devicesModel = mongoose.model(Device.name, DeviceSchema);
  const members = mongoose.model(HouseholdMember.name, HouseholdMemberSchema);
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const submissions = mongoose.model(Submission.name, SubmissionSchema);
  const ruleSets = mongoose.model(RuleSet.name, RuleSetSchema);
  const personalizationRules = mongoose.model(
    PersonalizationRule.name,
    PersonalizationRuleSchema
  );
  const devices = new DevicesService(devicesModel as never);
  const householdVerdicts = new HouseholdVerdictService(
    new ScoringService(
      ruleSets as never,
      mongoose.model(ScoringRecord.name, ScoringRecordSchema) as never,
      mongoose.model(Ingredient.name, IngredientSchema) as never,
      new VerdictCacheService(redis, config as never)
    ),
    new HouseholdService(
      members as never,
      mongoose.model(User.name, UserSchema) as never
    ),
    new PersonalizationService(personalizationRules as never),
    new ProductSummaryService(new ConfigService({}) as never)
  );
  const sender = new FakePushSender();
  const receiptChecks: CheckPushReceiptsJobData[] = [];
  const notifier = new PushNotifier(
    submissions as never,
    versions as never,
    devices,
    householdVerdicts,
    sender,
    {
      enqueuePushReceiptCheck: async (job: CheckPushReceiptsJobData) => {
        receiptChecks.push(job);
      },
    } as never
  );

  let seq = 0;
  /** A user with Papa (diabetes) and a ready submission for a sugary snack. */
  async function readySubmission() {
    const userId = new Types.ObjectId();
    await members.create({
      owner_user_id: userId,
      name: "Papa",
      relationship: "parent",
      conditions: ["diabetic"],
    });
    const barcode = `893${String(seq++).padStart(10, "0")}`;
    await versions.create({
      product_id: new Types.ObjectId(),
      barcode,
      name: "Masala chips",
      brand: "Local",
      category: "snacks",
      source: "user_submission",
      status: "live",
      nutrition: { sugar_per_100g: 18 },
    });
    const submission = await submissions.create({
      barcode,
      photo_hash: `hash-${seq}`,
      photo_keys: ["labels/x.jpg"],
      user_id: userId,
      status: "ready",
    });
    return {
      userId: userId.toHexString(),
      submissionId: submission.id as string,
    };
  }

  before(async () => {
    await connectTestDb("foodscanner_test_push");
    await ruleSets.create(HLD_RULE_SET_SEED);
    await personalizationRules.create(HLD_PERSONALIZATION_SEEDS);
  });

  beforeEach(() => {
    sender.sent = [];
    sender.ticketFor.clear();
    sender.receiptFor.clear();
    receiptChecks.length = 0;
  });

  after(async () => {
    await dropTestDb();
    await redis.client.quit();
  });

  describe("devices", () => {
    it("registers idempotently and moves a phone to whoever signs in on it", async () => {
      const first = new Types.ObjectId().toHexString();
      const second = new Types.ObjectId().toHexString();
      await devices.register(first, {
        expo_push_token: token("shared"),
        platform: "ios",
      });
      await devices.register(first, {
        expo_push_token: token("shared"),
        platform: "ios",
      });
      assert.deepEqual(await devices.tokensFor(first), [token("shared")]);

      await devices.register(second, {
        expo_push_token: token("shared"),
        platform: "ios",
      });
      assert.deepEqual(await devices.tokensFor(first), []);
      assert.deepEqual(await devices.tokensFor(second), [token("shared")]);
    });

    it("only lets the owner unregister a phone", async () => {
      const owner = new Types.ObjectId().toHexString();
      await devices.register(owner, {
        expo_push_token: token("mine"),
        platform: "android",
      });
      await devices.unregister(
        new Types.ObjectId().toHexString(),
        token("mine")
      );
      assert.deepEqual(await devices.tokensFor(owner), [token("mine")]);
      await devices.unregister(owner, token("mine"));
      assert.deepEqual(await devices.tokensFor(owner), []);
    });
  });

  describe("notifier", () => {
    it("sends the household verdict to every phone and schedules a receipt check", async () => {
      const { userId, submissionId } = await readySubmission();
      await devices.register(userId, {
        expo_push_token: token("p1"),
        platform: "ios",
      });
      await devices.register(userId, {
        expo_push_token: token("p2"),
        platform: "android",
      });

      await notifier.notifySubmission({ userId, submissionId, event: "ready" });

      assert.deepEqual(sender.sent.map((m) => [m.to, m.title, m.body]).sort(), [
        [token("p1"), "Masala chips is ready", "Avoid for Papa"],
        [token("p2"), "Masala chips is ready", "Avoid for Papa"],
      ]);
      assert.equal(sender.sent[0].data.submission_id, submissionId);
      assert.equal(receiptChecks[0].tickets.length, 2);
    });

    it("does nothing for a user without phones", async () => {
      const { userId, submissionId } = await readySubmission();
      await notifier.notifySubmission({ userId, submissionId, event: "ready" });
      assert.deepEqual(sender.sent, []);
    });

    it("forgets a phone Expo says is gone, but keeps it on a setup error", async () => {
      const { userId, submissionId } = await readySubmission();
      await devices.register(userId, {
        expo_push_token: token("gone"),
        platform: "ios",
      });
      await devices.register(userId, {
        expo_push_token: token("ours"),
        platform: "ios",
      });
      sender.ticketFor.set(token("gone"), {
        status: "error",
        error: "DeviceNotRegistered",
        message: "not registered",
      });
      sender.ticketFor.set(token("ours"), {
        status: "error",
        error: "InvalidCredentials",
        message: "bad APNs key",
      });

      await notifier.notifySubmission({ userId, submissionId, event: "ready" });
      assert.deepEqual(await devices.tokensFor(userId), [token("ours")]);
    });

    it("lets the queue retry only when nothing got through", async () => {
      const { userId, submissionId } = await readySubmission();
      await devices.register(userId, {
        expo_push_token: token("busy"),
        platform: "ios",
      });
      sender.ticketFor.set(token("busy"), {
        status: "error",
        error: "MessageRateExceeded",
        message: "slow down",
      });
      await assert.rejects(
        notifier.notifySubmission({ userId, submissionId, event: "ready" })
      );
    });

    it("forgets phones whose receipts say they're gone", async () => {
      const userId = new Types.ObjectId().toHexString();
      await devices.register(userId, {
        expo_push_token: token("late"),
        platform: "ios",
      });
      sender.receiptFor.set("ticket-late", {
        status: "error",
        error: "DeviceNotRegistered",
        message: "gone",
      });
      await notifier.checkReceipts({
        tickets: [{ id: "ticket-late", token: token("late") }],
      });
      assert.deepEqual(await devices.tokensFor(userId), []);
    });
  });
});
