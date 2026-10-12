import { Module } from "@nestjs/common";
import { ExactAliasLayer } from "./alias-layers";
import { AliasService } from "./alias.service";

@Module({
  providers: [ExactAliasLayer, AliasService],
  exports: [AliasService],
})
export class AliasModule {}
