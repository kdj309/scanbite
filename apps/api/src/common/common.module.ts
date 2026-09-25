import { Global, Module } from "@nestjs/common";
import { ExtractionQueueService } from "./extraction-queue.service";
import { ObjectStorageService } from "./object-storage.service";
import { VerdictCacheService } from "./verdict-cache.service";

@Global()
@Module({
  providers: [
    ObjectStorageService,
    ExtractionQueueService,
    VerdictCacheService,
  ],
  exports: [
    ObjectStorageService,
    ExtractionQueueService,
    VerdictCacheService,
  ],
})
export class CommonModule {}
