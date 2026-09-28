import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { isDuplicateKeyError } from "../../common/mongo-errors";
import type { Env } from "../../config/env";
import {
  PersonalizationRule,
  PersonalizationRuleDocument,
} from "../../database/schemas/personalization-rule.schema";
import {
  Product,
  ProductDocument,
} from "../../database/schemas/product.schema";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../../database/schemas/product-version.schema";
import {
  RuleSet,
  RuleSetDocument,
} from "../../database/schemas/rule-set.schema";
import { DEV_FIXTURE_BARCODE, DEV_FIXTURE_EXTRACTION } from "./dev-fixture";
import { HLD_PERSONALIZATION_SEED, HLD_RULE_SET_SEED } from "./hld-seed";

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectModel(RuleSet.name)
    private readonly ruleSets: Model<RuleSetDocument>,
    @InjectModel(PersonalizationRule.name)
    private readonly personalizationRules: Model<PersonalizationRuleDocument>,
    @InjectModel(Product.name)
    private readonly products: Model<ProductDocument>,
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>
  ) {}

  async onModuleInit(): Promise<void> {
    const env = this.config.get("NODE_ENV", { infer: true });
    if (env !== "development") {
      return;
    }
    await this.seedRuleSets();
    await this.seedPersonalization();
    await this.seedFixtureProduct();
  }

  private async seedRuleSets(): Promise<void> {
    const result = await this.ruleSets.updateOne(
      { version: HLD_RULE_SET_SEED.version },
      { $setOnInsert: HLD_RULE_SET_SEED },
      { upsert: true }
    );
    if (result.upsertedCount) {
      this.logger.log(`Seeded rule_set version ${HLD_RULE_SET_SEED.version}`);
    }
  }

  private async seedPersonalization(): Promise<void> {
    const result = await this.personalizationRules.updateOne(
      {
        version: HLD_PERSONALIZATION_SEED.version,
        condition: HLD_PERSONALIZATION_SEED.condition,
        field: HLD_PERSONALIZATION_SEED.field,
      },
      { $setOnInsert: HLD_PERSONALIZATION_SEED },
      { upsert: true }
    );
    if (result.upsertedCount) {
      this.logger.log("Seeded diabetic personalization rule");
    }
  }

  private async seedFixtureProduct(): Promise<void> {
    const existing = await this.versions
      .findOne({ barcode: DEV_FIXTURE_BARCODE, status: "live" })
      .exec();
    if (existing) {
      return;
    }

    let product = await this.products
      .findOne({ barcode: DEV_FIXTURE_BARCODE })
      .exec();
    if (!product) {
      try {
        product = await this.products.create({ barcode: DEV_FIXTURE_BARCODE });
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
        product = await this.products
          .findOne({ barcode: DEV_FIXTURE_BARCODE })
          .exec();
      }
    }
    if (!product) {
      return;
    }

    const fixture = DEV_FIXTURE_EXTRACTION;
    const [version] = await this.versions.create([
      {
        product_id: product._id,
        barcode: DEV_FIXTURE_BARCODE,
        name: fixture.name,
        brand: fixture.brand,
        category: fixture.category,
        ingredients: [],
        nutrition: fixture.nutrition,
        nova_group: fixture.nova_group,
        additive_count: fixture.additive_count,
        extraction_confidence: fixture.extraction_confidence,
        source: "off",
        status: "live",
      },
    ]);
    product.current_version_id = version._id as Types.ObjectId;
    await product.save();
    this.logger.log(`Seeded fixture product barcode ${DEV_FIXTURE_BARCODE}`);
  }
}
