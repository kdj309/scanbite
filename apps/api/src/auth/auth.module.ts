import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import type { Env } from "../config/env";
import { HouseholdModule } from "../household/household.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";
import { AppleCredentials } from "./apple/apple-credentials";
import { AppleNotificationService } from "./apple/apple-notification.service";
import {
  AppleTokenClient,
  HttpAppleTokenClient,
} from "./apple/apple-token-client";
import { AuthController } from "./auth.controller";
import { IdTokenVerifier, JoseIdTokenVerifier } from "./id-token-verifier";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtStrategy } from "./jwt.strategy";
import { RolesGuard } from "./roles.guard";
import { SessionService } from "./session.service";
import { SocialSignInService } from "./social-sign-in.service";

@Module({
  imports: [
    HouseholdModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_SECRET", { infer: true }),
        signOptions: {
          // Validated duration string ("15m"); the JWT types want their own
          // duration type.
          expiresIn: config.get("JWT_EXPIRES_IN", {
            infer: true,
          }) as NonNullable<JwtSignOptions["expiresIn"]>,
        },
      }),
    }),
  ],
  controllers: [AuthController, AccountController],
  providers: [
    AccountService,
    SessionService,
    SocialSignInService,
    AppleCredentials,
    AppleNotificationService,
    JwtStrategy,
    // Ports bound to their real implementations (tests use fakes).
    { provide: IdTokenVerifier, useClass: JoseIdTokenVerifier },
    { provide: AppleTokenClient, useClass: HttpAppleTokenClient },
    // Every route needs a valid token unless marked @Public/@OptionalAuth.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
