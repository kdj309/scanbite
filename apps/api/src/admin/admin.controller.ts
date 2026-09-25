import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  listUnresolvedTermsQuerySchema,
  resolveUnresolvedTermRequestSchema,
  type ListUnresolvedTermsQuery,
  type ResolveUnresolvedTermRequest,
} from "@foodscanner/shared";
import { Roles } from "../auth/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AdminService } from "./admin.service";

@Controller("admin/unresolved-terms")
@Roles("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listUnresolvedTermsQuerySchema))
    _query: ListUnresolvedTermsQuery,
  ) {
    return this.admin.listUnresolved();
  }

  @Post(":id/resolve")
  resolve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(resolveUnresolvedTermRequestSchema))
    body: ResolveUnresolvedTermRequest,
  ) {
    return this.admin.resolve(id, body);
  }
}
