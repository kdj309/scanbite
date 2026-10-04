import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AliasModule } from "./alias/alias.module";
import { AuthModule } from "./auth/auth.module";
import { AppThrottlerGuard } from "./common/app-throttler.guard";
import { CommonModule } from "./common/common.module";
import { type Env, validateEnv } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { HouseholdModule } from "./household/household.module";
import { PersonalizationModule } from "./personalization/personalization.module";
import { ProductsModule } from "./products/products.module";
import { RuleExplainersModule } from "./rule-explainers/rule-explainers.module";
import { ScansModule } from "./scans/scans.module";
import { ScoringModule } from "./scoring/scoring.module";
import { SubmissionsModule } from "./submissions/submissions.module";
import { WorkersModule } from "./workers/workers.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "apps/api/.env"],
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get("MONGODB_URI", { infer: true }),
        autoIndex: true,
      }),
    }),
    // In-memory storage — fine for v1's single-instance deployment (§3's
    // "monolith for v1" principle). Needs a shared (e.g. Redis-backed)
    // ThrottlerStorage before this ever runs as more than one instance,
    // or each instance tracks its own independent counters.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 60 }]),
    CommonModule,
    DatabaseModule,
    WorkersModule,
    AuthModule,
    HealthModule,
    HouseholdModule,
    ScoringModule,
    PersonalizationModule,
    AliasModule,
    ProductsModule,
    SubmissionsModule,
    ScansModule,
    AdminModule,
    RuleExplainersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
