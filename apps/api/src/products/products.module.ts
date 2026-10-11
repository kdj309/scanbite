import { Module } from "@nestjs/common";
import { ConsensusModule } from "../consensus/consensus.module";
import { HouseholdModule } from "../household/household.module";
import { OffModule } from "../off/off.module";
import { PersonalizationModule } from "../personalization/personalization.module";
import { ProductSummaryModule } from "../product-versions/product-summary.module";
import { ProductVersionIngestionModule } from "../product-versions/product-version-ingestion.module";
import { ScoringModule } from "../scoring/scoring.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [
    HouseholdModule,
    ScoringModule,
    PersonalizationModule,
    OffModule,
    ProductVersionIngestionModule,
    ConsensusModule,
    ProductSummaryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
