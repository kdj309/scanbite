import { Module } from "@nestjs/common";
import { HouseholdModule } from "../household/household.module";
import { PersonalizationModule } from "../personalization/personalization.module";
import { ScoringModule } from "../scoring/scoring.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [HouseholdModule, ScoringModule, PersonalizationModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
