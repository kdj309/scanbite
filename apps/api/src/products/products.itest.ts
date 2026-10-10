/**
 * Household lookup against real Mongo + Redis: one GET answers for every
 * member. Uses the dev seed rules (HLD examples + diabetic solid/drink).
 *
 *   pnpm --filter api build && pnpm --filter api test:integration
 */
import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ProductFoundResponse } from "@foodscanner/shared";
import { ConfigService } from "@nestjs/config";
import mongoose, { Types } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import {
  TEST_REDIS_URL,
  connectTestDb,
  dropTestDb,
} from "../common/integration-db";
import { RedisCacheService } from "../common/redis-cache.service";
import { VerdictCacheService } from "../common/verdict-cache.service";
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
import { User, UserSchema } from "../database/schemas/user.schema";
import { HouseholdService } from "../household/household.service";
import { PersonalizationService } from "../personalization/personalization.service";
import { ScoringService } from "../scoring/scoring.service";
import {
  HLD_PERSONALIZATION_SEEDS,
  HLD_RULE_SET_SEED,
} from "../workers/seed/hld-seed";
import { ProductsService } from "./products.service";

describe("product lookup for a household (integration)", () => {
  const config = new ConfigService({
    REDIS_URL: TEST_REDIS_URL,
    VERDICT_CACHE_TTL_SECONDS: 60,
  });
  const redis = new RedisCacheService(config as never);
  const versions = mongoose.model(ProductVersion.name, ProductVersionSchema);
  const members = mongoose.model(HouseholdMember.name, HouseholdMemberSchema);
  const users = mongoose.model(User.name, UserSchema);
  const ruleSets = mongoose.model(RuleSet.name, RuleSetSchema);
  const personalizationRules = mongoose.model(
    PersonalizationRule.name,
    PersonalizationRuleSchema
  );
  const household = new HouseholdService(members as never, users as never);
  const products = new ProductsService(
    versions as never,
    new ScoringService(
      ruleSets as never,
      mongoose.model(ScoringRecord.name, ScoringRecordSchema) as never,
      mongoose.model(Ingredient.name, IngredientSchema) as never,
      new VerdictCacheService(redis, config as never)
    ),
    new PersonalizationService(personalizationRules as never),
    household,
    // Only used to seed unknown barcodes; every barcode here is live.
    {} as never,
    {} as never,
    {} as never
  );

  const userId = new Types.ObjectId();
  const user = { userId: userId.toHexString() } as RequestUser;
  const addMember = (name: string, conditions: string[]) =>
    members.create({
      owner_user_id: userId,
      name,
      relationship: "other",
      conditions,
    });
  let ids: Record<string, string>;
  let barcodeSeq = 0;

  /** A live product with these nutrition facts; returns its barcode. */
  async function liveProduct(
    nutrition: Record<string, number>
  ): Promise<string> {
    const barcode = `itest-${Date.now()}-${barcodeSeq++}`;
    await versions.create({
      product_id: new Types.ObjectId(),
      barcode,
      name: "Test product",
      brand: "Test",
      category: "snacks",
      source: "manual_seed",
      status: "live",
      nutrition,
    });
    return barcode;
  }

  const lookup = async (barcode: string) =>
    (await products.lookup(barcode, user)) as ProductFoundResponse;

  before(async () => {
    await connectTestDb("foodscanner_test_products");
    await ruleSets.create(HLD_RULE_SET_SEED);
    await personalizationRules.create(HLD_PERSONALIZATION_SEEDS);
    const you = await addMember("You", []);
    const amma = await addMember("Amma", ["hypertensive"]);
    const papa = await addMember("Papa", ["diabetic"]);
    ids = { you: you.id, amma: amma.id, papa: papa.id };
  });

  after(async () => {
    await dropTestDb();
    await redis.client.quit();
  });

  it("returns every member's verdict and opens on the most affected", async () => {
    const result = await lookup(await liveProduct({ sugar_per_100g: 18 }));
    assert.deepEqual(result.overall, { severity: "red", member_id: ids.papa });
    assert.deepEqual(
      result.members.map((m) => [m.name, m.has_conditions, m.verdict.severity]),
      [
        ["You", false, "yellow"],
        ["Amma", true, "yellow"],
        ["Papa", true, "red"],
      ]
    );
    const papa = result.members[2].verdict.reasons[0];
    assert.equal(papa.rule_id, "diabetic_sugar_escalation");
    assert.equal(papa.label, "Too sweet for diabetes");
  });

  it("escalates a sugary drink for the diabetic member", async () => {
    const result = await lookup(await liveProduct({ sugar_per_100ml: 10.6 }));
    assert.deepEqual(result.overall, { severity: "red", member_id: ids.papa });
    assert.equal(
      result.members[2].verdict.reasons[0].rule_id,
      "diabetic_sugar_escalation_liquid"
    );
  });

  it("is green for everyone on a plain product", async () => {
    const result = await lookup(
      await liveProduct({ sugar_per_100g: 1, sodium_per_100g: 10 })
    );
    assert.deepEqual(result.overall, {
      severity: "green",
      member_id: ids.amma,
    });
    assert.ok(result.members.every((m) => m.verdict.severity === "green"));
  });
});
