import { Module } from "@nestjs/common";
import { HouseholdModule } from "../household/household.module";
import { ScoringModule } from "../scoring/scoring.module";
import { HouseholdVerdictService } from "./household-verdict.service";
import { PersonalizationService } from "./personalization.service";

@Module({
  imports: [ScoringModule, HouseholdModule],
  providers: [PersonalizationService, HouseholdVerdictService],
  exports: [PersonalizationService, HouseholdVerdictService],
})
export class PersonalizationModule {}
