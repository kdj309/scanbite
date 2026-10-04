import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/public.decorator";
import { RedisHealthIndicator } from "./redis-health.indicator";
import { S3HealthIndicator } from "./s3-health.indicator";

// Infra/load-balancer/uptime checks hit this frequently and must never get
// a false "unhealthy" reading from being rate-limited.
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly s3: S3HealthIndicator
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck("mongodb"),
      () => this.redis.check("redis"),
      () => this.s3.check("s3"),
    ]);
  }
}
