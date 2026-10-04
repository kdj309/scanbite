import { Controller, Get, Query } from "@nestjs/common";
import {
  listRuleExplainersQuerySchema,
  type ListRuleExplainersQuery,
} from "@foodscanner/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RuleExplainersService } from "./rule-explainers.service";

@Controller("rule-explainers")
export class RuleExplainersController {
  constructor(private readonly explainers: RuleExplainersService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listRuleExplainersQuerySchema))
    query: ListRuleExplainersQuery
  ) {
    return this.explainers.list(user, query);
  }
}
