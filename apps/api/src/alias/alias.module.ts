import { Module } from "@nestjs/common";
import {
  EmbeddingAliasLayer,
  ExactAliasLayer,
  SimilarityAliasLayer,
} from "./alias-layers";
import { AliasService } from "./alias.service";

@Module({
  providers: [
    ExactAliasLayer,
    SimilarityAliasLayer,
    EmbeddingAliasLayer,
    AliasService,
  ],
  exports: [AliasService],
})
export class AliasModule {}
