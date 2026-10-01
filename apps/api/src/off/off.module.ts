import { Module } from "@nestjs/common";
import { OffLookupService } from "./off-lookup.service";

@Module({
  providers: [OffLookupService],
  exports: [OffLookupService],
})
export class OffModule {}
