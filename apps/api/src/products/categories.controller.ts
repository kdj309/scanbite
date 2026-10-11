import { Controller, Get } from "@nestjs/common";
import { ProductsService } from "./products.service";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly products: ProductsService) {}

  /** Explore's category chips, with product counts. */
  @Get()
  list() {
    return this.products.categories();
  }
}
