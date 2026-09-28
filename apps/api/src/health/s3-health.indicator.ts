import { Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { S3StorageService } from "../common/s3-storage.service";

@Injectable()
export class S3HealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly s3: S3StorageService
  ) {}

  async check(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.s3.ping();
      return indicator.up();
    } catch (error) {
      return indicator.down(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
