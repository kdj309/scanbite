import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  resolveUnresolvedTermRequestSchema,
  type ResolveUnresolvedTermRequest,
} from "@foodscanner/shared";
import { Roles } from "../auth/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AdminService } from "./admin.service";

@Controller("admin/unresolved-terms")
@Roles("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Pending terms, most frequent first. */
  @Get()
  list() {
    return this.admin.listUnresolved();
  }

  @Post(":id/resolve")
  resolve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(resolveUnresolvedTermRequestSchema))
    body: ResolveUnresolvedTermRequest
  ) {
    return this.admin.resolve(id, body);
  }
}
