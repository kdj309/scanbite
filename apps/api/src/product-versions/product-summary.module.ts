import { Module } from "@nestjs/common";
import { ProductSummaryService } from "./product-summary";

@Module({
  providers: [ProductSummaryService],
  exports: [ProductSummaryService],
})
export class ProductSummaryModule {}
