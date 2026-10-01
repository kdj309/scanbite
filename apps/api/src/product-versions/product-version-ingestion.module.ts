import { Module } from "@nestjs/common";
import { AliasModule } from "../alias/alias.module";
import { ScoringModule } from "../scoring/scoring.module";
import { ProductVersionIngestionService } from "./product-version-ingestion.service";

@Module({
  imports: [AliasModule, ScoringModule],
  providers: [ProductVersionIngestionService],
  exports: [ProductVersionIngestionService],
})
export class ProductVersionIngestionModule {}
