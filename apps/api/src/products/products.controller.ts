import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  barcodeSchema,
  catalogQuerySchema,
  type CatalogQuery,
} from "@foodscanner/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  catalog(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(catalogQuerySchema)) query: CatalogQuery
  ) {
    return this.products.catalog(user, query);
  }

  /** Verdicts for every household member — see ProductFoundResponse. */
  @Get(":barcode")
  lookup(
    @CurrentUser() user: RequestUser,
    @Param("barcode", new ZodValidationPipe(barcodeSchema)) barcode: string
  ) {
    return this.products.lookup(barcode, user);
  }
}
