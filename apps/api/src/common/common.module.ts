import { Global, Module } from "@nestjs/common";
import { ObjectStorageService } from "./object-storage.service";
import { RedisCacheService } from "./redis-cache.service";
import { S3StorageService } from "./s3-storage.service";
import { VerdictCacheService } from "./verdict-cache.service";

@Global()
@Module({
  providers: [
    ObjectStorageService,
    RedisCacheService,
    S3StorageService,
    VerdictCacheService,
  ],
  exports: [
    ObjectStorageService,
    RedisCacheService,
    S3StorageService,
    VerdictCacheService,
  ],
})
export class CommonModule {}
