import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  productLookupQuerySchema,
  type ProductLookupQuery,
} from "@foodscanner/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get(":barcode")
  lookup(
    @CurrentUser() user: RequestUser,
    @Param("barcode") barcode: string,
    @Query(new ZodValidationPipe(productLookupQuerySchema))
    query: ProductLookupQuery,
  ) {
    return this.products.lookup(barcode, user, query.member_id);
  }
}
