import { Module } from "@nestjs/common";
import { HouseholdModule } from "../household/household.module";
import { PersonalizationModule } from "../personalization/personalization.module";
import { ProductSummaryModule } from "../product-versions/product-summary.module";
import { LabelChecksService } from "./label-checks.service";
import { SubmissionsController } from "./submissions.controller";
import { SubmissionsService } from "./submissions.service";

@Module({
  imports: [HouseholdModule, PersonalizationModule, ProductSummaryModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, LabelChecksService],
  exports: [SubmissionsService, LabelChecksService],
})
export class SubmissionsModule {}
