import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DatabaseIndexSyncService } from "./database-index-sync.service";
import {
  HouseholdMember,
  HouseholdMemberSchema,
  Ingredient,
  IngredientAlias,
  IngredientAliasSchema,
  IngredientSchema,
  PersonalizationRule,
  PersonalizationRuleSchema,
  Product,
  ProductSchema,
  ProductVersion,
  ProductVersionSchema,
  RuleSet,
  RuleSetSchema,
  Scan,
  ScanSchema,
  ScoringRecord,
  ScoringRecordSchema,
  Submission,
  SubmissionSchema,
  UnresolvedTerm,
  UnresolvedTermSchema,
  User,
  UserSchema,
} from "./schemas";

const models = [
  { name: User.name, schema: UserSchema },
  { name: HouseholdMember.name, schema: HouseholdMemberSchema },
  { name: Product.name, schema: ProductSchema },
  { name: ProductVersion.name, schema: ProductVersionSchema },
  { name: ScoringRecord.name, schema: ScoringRecordSchema },
  { name: Ingredient.name, schema: IngredientSchema },
  { name: IngredientAlias.name, schema: IngredientAliasSchema },
  { name: UnresolvedTerm.name, schema: UnresolvedTermSchema },
  { name: Scan.name, schema: ScanSchema },
  { name: RuleSet.name, schema: RuleSetSchema },
  { name: PersonalizationRule.name, schema: PersonalizationRuleSchema },
  { name: Submission.name, schema: SubmissionSchema },
];

@Global()
@Module({
  imports: [MongooseModule.forFeature(models)],
  providers: [DatabaseIndexSyncService],
  exports: [MongooseModule],
})
export class DatabaseModule {}
