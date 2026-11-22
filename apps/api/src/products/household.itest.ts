/**
 * Household verdicts against real Mongo + Redis: product lookup answers for
 * every member, and scans record each member's verdict for Home recents.
 * Uses the dev seed rules (HLD examples, diabetic sugar and condition salt
 * rules, solid/drink).
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
import {
  Submission,
  SubmissionSchema,
} from "../database/schemas/submission.schema";
import { LabelChecksService } from "../submissions/label-checks.service";
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
  const submissions = mongoose.model(Submission.name, SubmissionSchema);
  const deletedPhotos: string[] = [];
  const labelChecks = new LabelChecksService(
    submissions as never,
    scanModel as never,
    householdVerdicts,
    {
      deleteLabelPhoto: async (key: string) => {
        deletedPhotos.push(key);
      },
    } as never,
    summaries
  );
  const scans = new ScansService(
    scanModel as never,
    versions as never,
    household,
    householdVerdicts,
    products,
    summaries,
    labelChecks
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

  /** A read label check (a pack with no barcode) of this user's; returns its id. */
  async function readLabelCheck(
    userId: string,
    nutrition: Record<string, number>,
    status: "ready" | "processing" = "ready"
  ): Promise<string> {
    const check = await submissions.create({
      barcode: null,
      photo_hash: `label-${seq++}`,
      photo_keys: ["labels/no-barcode/a.jpg"],
      user_id: new Types.ObjectId(userId),
      status,
      label_facts:
        status === "ready"
          ? {
              name: "Besan laddoo",
              brand: "Local shop",
              category: "sweets",
              ingredients: [
                { raw: "gram flour", canonical_id: null, status: "unresolved" },
              ],
              nutrition,
            }
          : null,
    });
    return check.id as string;
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

    it("escalates a very salty snack to Avoid for the BP member only", async () => {
      // Ompudi (8908022078125): 1415 mg sodium/100 g.
      const { user, ids } = await newHousehold();
      const result = await lookup(
        await liveProduct({ sugar_per_100g: 0, sodium_per_100g: 1415.2 }),
        user
      );
      assert.deepEqual(result.overall, {
        severity: "red",
        member_id: ids.amma,
      });
      assert.deepEqual(
        result.members.map((m) => [m.name, m.verdict.severity]),
        [
          ["You", "yellow"],
          ["Amma", "red"],
          ["Papa", "yellow"],
        ]
      );
      const amma = result.members[1].verdict.reasons[0];
      assert.equal(amma.rule_id, "hypertensive_sodium_escalation");
      assert.equal(amma.label, "Too salty for BP");
    });

    it("says salt was checked for BP when it's low", async () => {
      const { user } = await newHousehold();
      const result = await lookup(
        await liveProduct({ sugar_per_100g: 1, sodium_per_100g: 10 }),
        user
      );
      const salt = result.members[1].verdict.checked.find(
        (check) => check.label === "Salt"
      );
      assert.deepEqual(salt?.for, ["hypertension"]);
    });

    it("is never Safe for the BP member when salt is missing", async () => {
      const { user } = await newHousehold();
      const result = await lookup(
        await liveProduct({ sugar_per_100g: 1 }),
        user
      );
      const amma = result.members[1].verdict;
      assert.equal(amma.severity, "yellow");
      assert.deepEqual(
        amma.reasons.map((r) => [r.kind, r.label, r.text]),
        [
          [
            "unchecked",
            "Salt not checked",
            "Couldn't check salt for hypertension",
          ],
        ]
      );
    });
  });

  describe("what we checked", () => {
    const labels = (result: ProductFoundResponse) =>
      result.members[0].verdict.checked.map((check) => check.label);

    it("ticks what was checked and passed, through a real lookup", async () => {
      const { user } = await newHousehold();
      const wheat = await mongoose
        .model(Ingredient.name, IngredientSchema)
        .create({
          canonical_name: `wheat flour ${seq}`,
          category: "uncategorized",
        });
      const barcode = await liveProduct({
        sugar_per_100g: 1,
        sodium_per_100g: 10,
      });
      await versions.updateOne(
        { barcode },
        {
          ingredients: [
            { raw: "Wheat flour", canonical_id: wheat._id, status: "resolved" },
          ],
        }
      );
      const result = (await products.lookup(
        barcode,
        user
      )) as ProductFoundResponse;
      assert.deepEqual(labels(result), ["Sugar", "Salt", "Palm oil"]);
    });

    it("doesn't tick palm oil when there's no ingredient list at all", async () => {
      const { user } = await newHousehold();
      const barcode = await liveProduct({
        sugar_per_100g: 1,
        sodium_per_100g: 10,
      });
      const result = (await products.lookup(
        barcode,
        user
      )) as ProductFoundResponse;
      assert.deepEqual(labels(result), ["Sugar", "Salt"]);
    });
  });

  describe("allergies", () => {
    it("flags an allergen found in the ingredients, for that member only", async () => {
      const { user, ids } = await newHousehold();
      await members.updateOne({ _id: ids.you }, { allergies: ["peanuts"] });
      const barcode = await liveProduct({
        sugar_per_100g: 1,
        sodium_per_100g: 10,
      });
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
    it("finds products on the same shelf Safe for everyone it isn't Safe for", async () => {
      const { user, ids } = await newHousehold();
      // A shelf no other test here uses; both categories sit on it.
      const category = "Sweets";
      const sweet = await liveProduct(
        { sugar_per_100g: 30 },
        { category, name: "Sweet" }
      );
      // Salt known and low, or it couldn't be Safe for Amma (BP).
      await liveProduct(
        { sugar_per_100g: 1, sodium_per_100g: 10 },
        { category: "Chocolate products", name: "Barely sweet" }
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

    it("finds a better ice cream whatever unit either label uses", async () => {
      const { user, ids } = await newHousehold();
      // Per 100 ml, as Indian ice cream labels usually are: never a drink.
      const sweet = await liveProduct(
        { sugar_per_100ml: 20, sodium_per_100ml: 40 },
        { category: "Ice cream", name: "Butterscotch" }
      );
      // Per 100 g, under the WHO frozen-dessert limits (12 g sugar).
      await liveProduct(
        { sugar_per_100g: 9, sodium_per_100g: 40 },
        { category: "Ice cream", name: "Less sweet" }
      );
      const result = await betterOptions.forProduct(sweet, user);
      // High sugar for a frozen dessert; Avoid for Papa (diabetes).
      assert.ok(result.for_member_ids.includes(ids.papa));
      assert.deepEqual(
        result.alternatives.map((a) => a.product.name),
        ["Less sweet"]
      );
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
      // Another shelf of its own: Dals, nuts & dry fruit.
      const sweet = await liveProduct(
        { sugar_per_100g: 30 },
        { category: "Legumes" }
      );
      await liveProduct(
        { sugar_per_100g: 1 },
        { category: "Nuts", name: "Plain" }
      );

      const result = await betterOptions.forProduct(sweet, user);
      assert.deepEqual(result.for_member_ids, []);
      assert.deepEqual(
        result.alternatives.map((a) => a.product.name),
        ["Plain"]
      );
    });

    it("has nothing to offer when the product is already Safe for them", async () => {
      const { user } = await newHousehold();
      // A real shelf, so it's the safety check that says no.
      const category = "Fats";
      const plain = await liveProduct(
        { sugar_per_100g: 1, sodium_per_100g: 10 },
        { category }
      );
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
    it("answers for the whole household by category, worst first", async () => {
      const { user, ids } = await newHousehold();
      const category = newCategory();
      // Complete data, so a Safe product genuinely has nothing to flag.
      await versions.create({
        product_id: new Types.ObjectId(),
        barcode: `891${String(seq++).padStart(10, "0")}`,
        name: "Plain",
        brand: "Test",
        category,
        source: "manual_seed",
        status: "live",
        nutrition: { sugar_per_100g: 1, sodium_per_100g: 10 },
        additive_count: 0,
        nova_group: 1,
      });
      await liveProduct({ sugar_per_100g: 18 }, { category, name: "Sweet" });
      await liveProduct({ sugar_per_100g: 18 }, { category: newCategory() });

      const page = await products.catalog(user, { category });
      // Amma (BP) and Papa (diabetes); "You" has no profile, so isn't counted.
      assert.deepEqual(
        [...page.for_member_ids].sort(),
        [ids.amma, ids.papa].sort()
      );
      assert.deepEqual(
        page.items.map((item) => [
          item.product.name,
          item.overall.severity,
          item.main_reason?.label ?? null,
        ]),
        [
          ["Sweet", "red", "Too sweet for diabetes"],
          ["Plain", "green", null],
        ]
      );
      assert.deepEqual(
        page.items[0].members.map((m) => [m.member_id, m.severity]),
        [
          [ids.amma, "yellow"],
          [ids.papa, "red"],
        ]
      );
    });

    it("splits into 'good for everyone' and 'not for everyone'", async () => {
      const { user } = await newHousehold();
      const category = newCategory();
      await liveProduct(
        { sugar_per_100g: 1, sodium_per_100g: 10 },
        { category, name: "Plain" }
      );
      await liveProduct({ sugar_per_100g: 18 }, { category, name: "Sweet" });

      const good = await products.catalog(user, {
        category,
        section: "good_for_all",
      });
      const notGood = await products.catalog(user, {
        category,
        section: "not_for_all",
      });
      assert.deepEqual(
        good.items.map((i) => i.product.name),
        ["Plain"]
      );
      assert.deepEqual(
        notGood.items.map((i) => i.product.name),
        ["Sweet"]
      );
    });

    it("answers only for the people being shopped for", async () => {
      const { user, ids } = await newHousehold();
      const category = newCategory();
      await liveProduct({ sugar_per_100g: 18 }, { category, name: "Sweet" });

      const forAmma = await products.catalog(user, {
        category,
        member_ids: [ids.amma],
      });
      assert.deepEqual(forAmma.for_member_ids, [ids.amma]);
      assert.deepEqual(forAmma.items[0].overall, {
        severity: "yellow",
        member_id: ids.amma,
      });
    });

    it("refuses members without a health profile or from another household", async () => {
      const { user, ids } = await newHousehold();
      const other = await newHousehold();
      for (const memberIds of [[ids.you], [other.ids.papa]]) {
        await assert.rejects(
          products.catalog(user, { member_ids: memberIds }),
          /health profile/
        );
      }
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

    it("uses the general verdict when nobody has a profile yet", async () => {
      const userId = new Types.ObjectId();
      await members.create({
        owner_user_id: userId,
        name: "You",
        relationship: "self",
        conditions: [],
      });
      const user = { userId: userId.toHexString() } as RequestUser;
      const category = newCategory();
      await liveProduct({ sugar_per_100g: 30 }, { category });

      const page = await products.catalog(user, { category });
      assert.deepEqual(page.for_member_ids, []);
      assert.deepEqual(page.items[0].overall, {
        severity: "red",
        member_id: null,
      });
    });
  });

  describe("search from Home (design 1e)", () => {
    it("finds live products by name or brand, best match first, with barcodes", async () => {
      // A made-up word, so other tests' products never match.
      const crunch = await liveProduct(
        {},
        { name: "Choco Zorbit Cream", brand: "Kwik" }
      );
      const first = await liveProduct(
        {},
        { name: "Zorbit Classic", brand: "Kwik" }
      );
      const byBrand = await liveProduct(
        {},
        { name: "Rusk", brand: "Zorbit Foods" }
      );
      await versions.create({
        product_id: new Types.ObjectId(),
        barcode: "8910000999999",
        name: "Zorbit Draft",
        brand: "Kwik",
        category: "snacks",
        source: "manual_seed",
        status: "pending",
        nutrition: {},
      });

      const { items } = await products.search("zorbit");

      assert.deepEqual(
        items.map((i) => i.barcode),
        [first, crunch, byBrand]
      );
      assert.equal(items[0].name, "Zorbit Classic");
      assert.equal(items[0].brand, "Kwik");
    });

    it("leaves out products whose barcode the product screen can't open", async () => {
      await versions.create({
        product_id: new Types.ObjectId(),
        barcode: "12345",
        name: "Quorbel Snack",
        brand: "Kwik",
        category: "snacks",
        source: "off",
        status: "live",
        nutrition: {},
      });
      const ok = await liveProduct({}, { name: "Quorbel Crisps" });
      const { items } = await products.search("quorbel");
      assert.deepEqual(
        items.map((i) => i.barcode),
        [ok]
      );
    });

    it("treats the query as text, not a pattern", async () => {
      const { items } = await products.search("(.*");
      assert.deepEqual(items, []);
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

    it("forgets what each person was shown once consent is withdrawn", async () => {
      const { user, ids } = await newHousehold();
      const barcode = await liveProduct({
        sugar_per_100g: 0,
        sodium_per_100g: 1415.2,
      });
      const { scan_id } = await scans.create(user, { barcode });
      assert.equal((await recorded(user, scan_id)).severity, "red");

      await household.clearHealthInfo(user.userId);
      await scans.forgetPersonalVerdicts(user.userId);

      // The general verdict now, for everyone: nothing left hints at BP.
      const scan = await recorded(user, scan_id);
      assert.equal(scan.severity, "yellow");
      assert.deepEqual(
        scan.verdicts.map((v) => [v.member_id, v.severity]),
        [
          [ids.you, "yellow"],
          [ids.amma, "yellow"],
          [ids.papa, "yellow"],
        ]
      );
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
      // Kept in the log, though Recent scans leaves misses out.
      const scan = (await scanModel.findById(scan_id).lean().exec())!;
      assert.deepEqual(
        [scan.found, scan.product_version_id, scan.severity, scan.verdicts],
        [false, null, null, []]
      );
      assert.equal(await recorded(user, scan_id), undefined);
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
  describe("label checks (no barcode)", () => {
    it("checks a label for the family, like a product but never in the catalog", async () => {
      const { user, ids } = await newHousehold();
      const id = await readLabelCheck(user.userId, { sugar_per_100g: 38 });
      const result = await labelChecks.verdict(id, user.userId);
      const papa = result.members.find((m) => m.member_id === ids.papa);
      assert.equal(papa?.verdict.severity, "red");
      assert.equal(
        papa?.verdict.reasons[0].rule_id,
        "diabetic_sugar_escalation"
      );
      assert.deepEqual(
        [
          result.product.source,
          result.product.product_version_id,
          result.product.verifying,
        ],
        ["label_check", id, false]
      );
      // Store searches by brand and name; the app shows them only when Safe.
      assert.deepEqual(
        result.product.buy_links.map((link) => link.store),
        ["amazon", "bigbasket"]
      );
    });

    it("is only for the person who sent it, once it's read", async () => {
      const { user } = await newHousehold();
      const { user: other } = await newHousehold();
      const id = await readLabelCheck(user.userId, {});
      await assert.rejects(labelChecks.verdict(id, other.userId), /not found/);
      const reading = await readLabelCheck(user.userId, {}, "processing");
      await assert.rejects(
        labelChecks.verdict(reading, user.userId),
        /not found/
      );
      await assert.rejects(
        labelChecks.verdict("not-an-id", user.userId),
        /not found/
      );
    });

    it("records each check's scan for who it's for, and lists them apart", async () => {
      const { user, ids } = await newHousehold();
      const first = await readLabelCheck(user.userId, { sugar_per_100g: 38 });
      const second = await readLabelCheck(user.userId, {});
      await submissions.updateOne(
        { _id: first },
        { $set: { for_member_id: new Types.ObjectId(ids.papa) } }
      );
      const record = async (id: string) =>
        scans.recordLabelCheck(
          (await submissions.findById(id).exec()) as never
        );
      await record(first);
      await record(second);
      await record(first);

      const recent = await scans.listForHousehold(user, {});
      assert.deepEqual(
        recent.items.map((s) => [
          s.barcode,
          s.label_check_id,
          s.product?.source,
        ]),
        [
          [null, first, "label_check"],
          [null, second, "label_check"],
        ]
      );
      assert.deepEqual(
        [recent.items[0].member_id, recent.items[0].severity],
        [ids.papa, "red"]
      );
      const forPapa = await scans.listForMember(user, ids.papa, {});
      assert.deepEqual(
        forPapa.items.map((s) => s.label_check_id),
        [first]
      );
    });
  });
  describe("removing a recent scan", () => {
    it("removes every scan of that product, and keeps the product", async () => {
      const { user } = await newHousehold();
      const kept = await liveProduct({});
      const removed = await liveProduct({});
      await scans.create(user, { barcode: removed });
      await scans.create(user, { barcode: kept });
      const { scan_id } = await scans.create(user, { barcode: removed });

      await scans.remove(user, scan_id);

      const recent = await scans.listForHousehold(user, {});
      assert.deepEqual(
        recent.items.map((s) => s.barcode),
        [kept]
      );
      assert.ok(
        await versions.exists({ barcode: removed, status: "live" }),
        "still in the catalog"
      );
    });

    it("erases a label check whole: photos, what was read, its scans", async () => {
      const { user } = await newHousehold();
      const id = await readLabelCheck(user.userId, {});
      await scans.recordLabelCheck(
        (await submissions.findById(id).exec()) as never
      );
      const [row] = (await scans.listForHousehold(user, {})).items;

      await scans.remove(user, row.id);

      assert.equal(await submissions.exists({ _id: id }), null);
      assert.equal(await scanModel.exists({ label_check_id: id }), null);
      assert.ok(deletedPhotos.includes("labels/no-barcode/a.jpg"));
    });

    it("can't remove someone else's scan", async () => {
      const { user } = await newHousehold();
      const { user: other } = await newHousehold();
      const { scan_id } = await scans.create(user, {
        barcode: await liveProduct({}),
      });
      await assert.rejects(scans.remove(other, scan_id), /not found/i);
      assert.ok(await scanModel.exists({ _id: scan_id }));
    });
  });
});
