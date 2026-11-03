import { Module } from "@nestjs/common";
import { HouseholdModule } from "../household/household.module";
import { PersonalizationModule } from "../personalization/personalization.module";
import { ProductSummaryModule } from "../product-versions/product-summary.module";
import { ProductsModule } from "../products/products.module";
import { SubmissionsModule } from "../submissions/submissions.module";
import { ScansController } from "./scans.controller";
import { ScansService } from "./scans.service";

@Module({
  imports: [
    HouseholdModule,
    PersonalizationModule,
    ProductsModule,
    ProductSummaryModule,
    SubmissionsModule,
  ],
  controllers: [ScansController],
  providers: [ScansService],
  exports: [ScansService],
})
export class ScansModule {}
