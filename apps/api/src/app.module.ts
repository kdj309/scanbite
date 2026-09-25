import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminModule } from "./admin/admin.module";
import { AliasModule } from "./alias/alias.module";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { type Env, validateEnv } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { HouseholdModule } from "./household/household.module";
import { PersonalizationModule } from "./personalization/personalization.module";
import { ProductsModule } from "./products/products.module";
import { ScansModule } from "./scans/scans.module";
import { ScoringModule } from "./scoring/scoring.module";
import { SubmissionsModule } from "./submissions/submissions.module";

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
    CommonModule,
    DatabaseModule,
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
  ],
})
export class AppModule {}
