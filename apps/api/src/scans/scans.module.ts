import { Module } from "@nestjs/common";
import { HouseholdModule } from "../household/household.module";
import { PersonalizationModule } from "../personalization/personalization.module";
import { ScoringModule } from "../scoring/scoring.module";
import { ScansController } from "./scans.controller";
import { ScansService } from "./scans.service";

@Module({
  imports: [HouseholdModule, ScoringModule, PersonalizationModule],
  controllers: [ScansController],
  providers: [ScansService],
  exports: [ScansService],
})
export class ScansModule {}
