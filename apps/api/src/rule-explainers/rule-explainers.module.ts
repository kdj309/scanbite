import { Module } from "@nestjs/common";
import { HouseholdModule } from "../household/household.module";
import { RuleExplainersController } from "./rule-explainers.controller";
import { RuleExplainersService } from "./rule-explainers.service";

@Module({
  imports: [HouseholdModule],
  controllers: [RuleExplainersController],
  providers: [RuleExplainersService],
})
export class RuleExplainersModule {}
