/**
 * Household verdicts against real Mongo + Redis: product lookup answers for
 * every member, and scans record each member's verdict for Home recents.
 * Uses the dev seed rules (HLD examples + diabetic solid/drink).
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
import { AlternativesService } from "../alternatives/alternatives.service";
import { ConsensusService } from "../consensus/consensus.service";
import { Product, ProductSchema } from "../database/schemas/product.schema";
import { Scan, ScanSchema } from "../database/schemas/scan.schema";
import type { OffExtraction } from "../off/off-extraction";
import { ProductSummaryService } from "../product-versions/product-summary";
import { ProductVersionIngestionService } from "../product-versions/product-version-ingestion.service";
import { HouseholdVerdictService } from "../personalization/household-verdict.service";
import { PersonalizationService } from "../personalization/personalization.service";
import { ScansService } from "../scans/scans.service";
import { ScoringService } from "../scoring/scoring.service";
import {
  HLD_PERSONALIZATION_SEEDS,
  HLD_RULE_SET_SEED,
} from "../workers/seed/hld-seed";
import { ProductsService } from "./products.service";

describe("household verdicts (integration)", () => {
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
  const scoring = new ScoringService(
    ruleSets as never,
    mongoose.model(ScoringRecord.name, ScoringRecordSchema) as never,
    mongoose.model(Ingredient.name, IngredientSchema) as never,
    new VerdictCacheService(redis, config as never)
  );
  // A tag, so the itests also cover the affiliate link reaching the app.
  const summaries = new ProductSummaryService(
    new ConfigService({ AMAZON_ASSOCIATE_TAG: "itest-21" }) as never
  );
  const personalization = new PersonalizationService(
    personalizationRules as never
  );
  const householdVerdicts = new HouseholdVerdictService(
    scoring,
    household,
    personalization,
    summaries
  );
  const productModel = mongoose.model(Product.name, ProductSchema);
  // Open Food Facts knows exactly one barcode; ingredient matching is
  // stubbed (alias resolution has its own tests).
  const OFF_BARCODE = "8900000000017";
  const fakeOff = {
    lookup: async (barcode: string): Promise<OffExtraction | null> =>
      barcode === OFF_BARCODE
        ? {
            name: "OFF biscuits",
            brand: "OFF",
            category: "biscuits",
            ingredients: ["wheat flour", "sugar"],
            nutrition: { sugar_per_100g: 30 },
            extraction_confidence: 0.9,
            image_url: "https://images.openfoodfacts.org/front.jpg",
            quantity: "100 g",
            declared_allergens: { contains: ["gluten"], may_contain: [] },
            declared_veg: "veg",
          }
        : null,
  };
  const ingestion = new ProductVersionIngestionService(
    productModel as never,
    versions as never,
    {
      resolveRaw: async () => ({ status: "unresolved", canonical_id: null }),
    } as never,
    scoring
  );
  const products = new ProductsService(
    versions as never,
    scoring,
    personalization,
    householdVerdicts,
    household,
    fakeOff as never,
    ingestion,
    new ConsensusService(
      mongoose.connection,
      versions as never,
      productModel as never
    ),
    summaries
  );
  const betterOptions = new AlternativesService(
    versions as never,
    scoring,
    personalization,
    household,
    summaries
  );
  const scanModel = mongoose.model(Scan.name, ScanSchema);
  const scans = new ScansService(
    scanModel as never,
    versions as never,
    household,
    householdVerdicts,
    products,
    summaries
  );

  let seq = 0;

  /**
   * A fresh household per test — You (no conditions), Amma (BP), Papa
   * (diabetes) — so no test depends on another's data.
   */
  async function newHousehold() {
    const userId = new Types.ObjectId();
    const add = (name: string, conditions: string[]) =>
      members.create({
        owner_user_id: userId,
        name,
        relationship: "other",
        conditions,
      });
    const you = await add("You", []);
    const amma = await add("Amma", ["hypertensive"]);
    const papa = await add("Papa", ["diabetic"]);
    return {
      user: {
        userId: userId.toHexString(),
        defaultMemberId: you.id,
      } as RequestUser,
      ids: {
        you: you.id as string,
        amma: amma.id as string,
        papa: papa.id as string,
      },
    };
  }

  /** A live product with these nutrition facts; returns its barcode. */
  async function liveProduct(
    nutrition: Record<string, number>,
    fields: { name?: string; brand?: string; category?: string } = {}
  ): Promise<string> {
    const barcode = `891${String(seq++).padStart(10, "0")}`;
    await versions.create({
      product_id: new Types.ObjectId(),
      barcode,
      name: "Test product",
      brand: "Test",
      category: "snacks",
      ...fields,
      source: "manual_seed",
      status: "live",
      nutrition,
    });
    return barcode;
  }

  /** Catalog tests each use their own category, so they only see their own products. */
  const newCategory = () => `itest-category-${seq++}`;

  before(async () => {
    await connectTestDb("foodscanner_test_household");
    await ruleSets.create(HLD_RULE_SET_SEED);
    await personalizationRules.create(HLD_PERSONALIZATION_SEEDS);
  });

  after(async () => {
    await dropTestDb();
    await redis.client.quit();
  });

  describe("product lookup", () => {
    const lookup = async (barcode: string, user: RequestUser) =>
      (await products.lookup(barcode, user)) as ProductFoundResponse;

    it("returns every member's verdict and opens on the most affected", async () => {
      const { user, ids } = await newHousehold();
      const result = await lookup(
        await liveProduct({ sugar_per_100g: 18 }),
        user
      );
      assert.deepEqual(result.overall, {
        severity: "red",
        member_id: ids.papa,
      });
      assert.deepEqual(
        result.members.map((m) => [
          m.name,
          m.has_health_profile,
          m.verdict.severity,
        ]),
        [
          ["You", false, "yellow"],
          ["Amma", true, "yellow"],
          ["Papa", true, "red"],
        ]
      );
      assert.deepEqual(
        [result.product.source, result.product.verifying],
        ["catalog", false]
      );
      const papa = result.members[2].verdict.reasons[0];
      assert.equal(papa.rule_id, "diabetic_sugar_escalation");
      assert.equal(papa.label, "Too sweet for diabetes");
    });

    it("escalates a sugary drink for the diabetic member", async () => {
      const { user, ids } = await newHousehold();
      const result = await lookup(
        await liveProduct({ sugar_per_100ml: 10.6 }),
        user
      );
      assert.deepEqual(result.overall, {
        severity: "red",
        member_id: ids.papa,
      });
      assert.equal(
        result.members[2].verdict.reasons[0].rule_id,
        "diabetic_sugar_escalation_liquid"
      );
    });

    it("is green for everyone on a plain product", async () => {
      const { user, ids } = await newHousehold();
      const result = await lookup(
        await liveProduct({ sugar_per_100g: 1, sodium_per_100g: 10 }),
        user
      );
      assert.deepEqual(result.overall, {
        severity: "green",
        member_id: ids.amma,
      });
      assert.ok(result.members.every((m) => m.verdict.severity === "green"));
    });
  });

  describe("allergies", () => {
    it("flags an allergen found in the ingredients, for that member only", async () => {
      const { user, ids } = await newHousehold();
      await members.updateOne({ _id: ids.you }, { allergies: ["peanuts"] });
      const barcode = await liveProduct({ sugar_per_100g: 1 });
      await versions.updateOne(
        { barcode },
        {
          ingredients: [
            { raw: "Groundnut Oil", canonical_id: null, status: "unresolved" },
          ],
        }
      );

      const result = (await products.lookup(
        barcode,
        user
      )) as ProductFoundResponse;
      const you = result.members[0];
      assert.equal(you.has_health_profile, true);
      assert.equal(you.verdict.severity, "red");
      assert.equal(you.verdict.reasons[0].label, "Contains peanuts");
      // The others aren't allergic.
      assert.equal(result.members[1].verdict.severity, "green");
      // An allergy alone makes You the one the screen opens on.
      assert.deepEqual(result.overall, { severity: "red", member_id: ids.you });
    });
  });

  describe("better options", () => {
    it("finds same-category products Safe for everyone it isn't Safe for", async () => {
      const { user, ids } = await newHousehold();
      const category = newCategory();
      const sweet = await liveProduct(
        { sugar_per_100g: 30 },
        { category, name: "Sweet" }
      );
      await liveProduct(
        { sugar_per_100g: 1 },
        { category, name: "Barely sweet" }
      );
      await liveProduct(
        { sugar_per_100g: 10 },
        { category, name: "Still sweet" }
      );
      await liveProduct({ sugar_per_100ml: 0 }, { category, name: "A drink" });
      await liveProduct(
        { sugar_per_100g: 0 },
        { category: newCategory(), name: "Elsewhere" }
      );
      // Can't show or link to a product we can't name.
      await liveProduct({ sugar_per_100g: 0 }, { category, name: "Unknown" });

      const result = await betterOptions.forProduct(sweet, user);
      assert.equal(result.instead_of.name, "Sweet");
      // Very high sugar: not Safe for Amma (BP) or Papa (diabetes).
      assert.deepEqual(
        [...result.for_member_ids].sort(),
        [ids.amma, ids.papa].sort()
      );
      assert.deepEqual(
        result.alternatives.map((a) => [
          a.product.name,
          a.improvements[0].label,
        ]),
        [["Barely sweet", "97% less sugar"]]
      );
      assert.equal(result.alternatives[0].product.buy_links.length, 2);
    });

    it("uses the general verdict when nobody has a profile yet", async () => {
      // A brand-new household: only "You", no conditions or allergies.
      const userId = new Types.ObjectId();
      await members.create({
        owner_user_id: userId,
        name: "You",
        relationship: "self",
        conditions: [],
      });
      const user = { userId: userId.toHexString() } as RequestUser;
      const category = newCategory();
      const sweet = await liveProduct({ sugar_per_100g: 30 }, { category });
      await liveProduct({ sugar_per_100g: 1 }, { category, name: "Plain" });

      const result = await betterOptions.forProduct(sweet, user);
      assert.deepEqual(result.for_member_ids, []);
      assert.deepEqual(
        result.alternatives.map((a) => a.product.name),
        ["Plain"]
      );
    });

    it("has nothing to offer when the product is already Safe for them", async () => {
      const { user } = await newHousehold();
      const category = newCategory();
      const plain = await liveProduct({ sugar_per_100g: 1 }, { category });
      await liveProduct({ sugar_per_100g: 0 }, { category });
      const result = await betterOptions.forProduct(plain, user);
      assert.deepEqual([result.for_member_ids, result.alternatives], [[], []]);
    });

    it("has nothing to offer when the category is unknown", async () => {
      const { user } = await newHousehold();
      const sweet = await liveProduct(
        { sugar_per_100g: 30 },
        { category: "unknown" }
      );
      await liveProduct({ sugar_per_100g: 0 }, { category: "unknown" });
      assert.deepEqual(
        (await betterOptions.forProduct(sweet, user)).alternatives,
        []
      );
    });
  });

  describe("categories", () => {
    it("counts live products per category, biggest first, without unknown", async () => {
      const big = newCategory();
      const small = newCategory();
      for (let i = 0; i < 3; i += 1) {
        await liveProduct({}, { category: big });
      }
      await liveProduct({}, { category: small });
      await liveProduct({}, { category: "unknown" });

      const { categories } = await products.categories();
      const mine = categories.filter((c) => c.name === big || c.name === small);
      assert.deepEqual(mine, [
        { name: big, count: 3 },
        { name: small, count: 1 },
      ]);
      assert.ok(categories.every((c) => c.name !== "unknown"));

      // A chip's count matches what the catalog shows for it.
      const { user } = await newHousehold();
      const page = await products.catalog(user, { category: big });
      assert.equal(page.items.length, 3);
    });
  });

  describe("catalog", () => {
    it("filters by category and answers for the chosen member", async () => {
      const { user, ids } = await newHousehold();
      const category = newCategory();
      await liveProduct({ sugar_per_100g: 18 }, { category, name: "Sweet" });
      await liveProduct({ sugar_per_100g: 1 }, { category, name: "Plain" });
      await liveProduct({ sugar_per_100g: 18 }, { category: newCategory() });

      const page = await products.catalog(user, {
        category,
        member_id: ids.papa,
      });
      assert.equal(page.member_has_health_profile, true);
      assert.deepEqual(
        page.items.map((item) => [item.product.name, item.verdict.severity]),
        [
          ["Plain", "green"],
          ["Sweet", "red"],
        ]
      );
    });

    it("searches name and brand, ignoring case", async () => {
      const { user } = await newHousehold();
      const category = newCategory();
      await liveProduct(
        {},
        { category, name: "Masala Chips", brand: "Crunchy" }
      );
      await liveProduct(
        {},
        { category, name: "Plain Rusk", brand: "Bake House" }
      );

      const byName = await products.catalog(user, { category, q: "MASALA" });
      assert.deepEqual(
        byName.items.map((i) => i.product.name),
        ["Masala Chips"]
      );
      const byBrand = await products.catalog(user, { category, q: "bake" });
      assert.deepEqual(
        byBrand.items.map((i) => i.product.name),
        ["Plain Rusk"]
      );
    });

    it("filters by severity after scoring, for that member", async () => {
      const { user, ids } = await newHousehold();
      const category = newCategory();
      await liveProduct({ sugar_per_100g: 18 }, { category, name: "Sweet" });
      await liveProduct({ sugar_per_100g: 1 }, { category, name: "Plain" });

      const red = await products.catalog(user, {
        category,
        member_id: ids.papa,
        severity: "red",
      });
      assert.deepEqual(
        red.items.map((i) => i.product.name),
        ["Sweet"]
      );
      // Same product is only yellow for someone without diabetes.
      const forAmma = await products.catalog(user, {
        category,
        member_id: ids.amma,
        severity: "red",
      });
      assert.deepEqual(forAmma.items, []);
    });

    it("pages with a cursor, newest first, without repeats", async () => {
      const { user } = await newHousehold();
      const category = newCategory();
      for (const name of ["First", "Second", "Third"]) {
        await liveProduct({}, { category, name });
      }

      const first = await products.catalog(user, { category, limit: 2 });
      assert.deepEqual(
        first.items.map((i) => i.product.name),
        ["Third", "Second"]
      );
      assert.ok(first.next_cursor);
      const rest = await products.catalog(user, {
        category,
        limit: 2,
        cursor: first.next_cursor!,
      });
      assert.deepEqual(
        rest.items.map((i) => i.product.name),
        ["First"]
      );
      assert.equal(rest.next_cursor, null);
    });

    it("tells the app when the member has no conditions yet", async () => {
      const { user } = await newHousehold(); // default member: You
      const page = await products.catalog(user, { category: newCategory() });
      assert.equal(page.member_has_health_profile, false);
    });
  });

  describe("scans", () => {
    const recorded = async (user: RequestUser, scanId: string) =>
      (await scans.listForHousehold(user, {})).items.find(
        (item) => item.id === scanId
      )!;

    it("returns the verdict and records every member's, for everyone", async () => {
      const { user, ids } = await newHousehold();
      const barcode = await liveProduct({ sugar_per_100g: 18 });
      const { scan_id, result } = await scans.create(user, { barcode });
      assert.ok(result.found);
      assert.deepEqual(result.overall, {
        severity: "red",
        member_id: ids.papa,
      });

      const scan = await recorded(user, scan_id);
      assert.equal(scan.member_id, null);
      assert.equal(scan.severity, "red");
      assert.deepEqual(
        scan.verdicts.map((v) => [v.member_id, v.severity]),
        [
          [ids.you, "yellow"],
          [ids.amma, "yellow"],
          [ids.papa, "red"],
        ]
      );
      assert.equal(scan.product?.name, "Test product");
    });

    it("stores the chosen member's own verdict for 'Scan for Amma'", async () => {
      const { user, ids } = await newHousehold();
      const barcode = await liveProduct({ sugar_per_100g: 18 });
      const { scan_id } = await scans.create(user, {
        barcode,
        member_id: ids.amma,
      });
      const scan = await recorded(user, scan_id);
      assert.deepEqual(
        [scan.member_id, scan.severity, scan.verdicts.length],
        [ids.amma, "yellow", 3]
      );
      const forAmma = await scans.listForMember(user, ids.amma, {});
      assert.deepEqual(
        forAmma.items.map((s) => s.id),
        [scan_id]
      );
    });

    it("imports a never-seen barcode from Open Food Facts and records it as found", async () => {
      const { user } = await newHousehold();
      const { scan_id, result } = await scans.create(user, {
        barcode: OFF_BARCODE,
      });
      assert.ok(result.found);
      assert.deepEqual(
        [result.product.name, result.product.source, result.product.quantity],
        ["OFF biscuits", "catalog", "100 g"]
      );
      assert.deepEqual(
        result.product.buy_links.map((link) => [link.store, link.affiliate]),
        [
          ["amazon", true],
          ["bigbasket", false],
        ]
      );
      assert.equal(result.product.veg, "veg");
      const scan = await recorded(user, scan_id);
      assert.deepEqual([scan.found, scan.severity], [true, "red"]);
    });

    it("records a product nobody knows as not found", async () => {
      const { user } = await newHousehold();
      const { scan_id, result } = await scans.create(user, {
        barcode: "8900000000099",
      });
      assert.deepEqual(result, { found: false });
      const scan = await recorded(user, scan_id);
      assert.deepEqual(
        [scan.found, scan.product, scan.severity, scan.verdicts],
        [false, null, null, []]
      );
    });

    it("lists household recents newest first, and pages", async () => {
      const { user } = await newHousehold();
      const barcodes = [
        await liveProduct({}),
        await liveProduct({}),
        await liveProduct({}),
      ];
      for (const barcode of barcodes) {
        await scans.create(user, { barcode });
      }

      const first = await scans.listForHousehold(user, { limit: 2 });
      assert.deepEqual(
        first.items.map((s) => s.barcode),
        [barcodes[2], barcodes[1]]
      );
      const rest = await scans.listForHousehold(user, {
        limit: 2,
        cursor: first.next_cursor!,
      });
      assert.deepEqual(
        rest.items.map((s) => s.barcode),
        [barcodes[0]]
      );
      assert.equal(rest.next_cursor, null);
    });
  });
});
