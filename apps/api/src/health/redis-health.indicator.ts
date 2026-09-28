import { Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { RedisCacheService } from "../common/redis-cache.service";

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisCache: RedisCacheService
  ) {}

  async check(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.redisCache.client.ping();
      return indicator.up();
    } catch (error) {
      return indicator.down(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
