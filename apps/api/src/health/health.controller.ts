import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from "@nestjs/terminus";
import { Public } from "../auth/public.decorator";
import { RedisHealthIndicator } from "./redis-health.indicator";
import { S3HealthIndicator } from "./s3-health.indicator";

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
