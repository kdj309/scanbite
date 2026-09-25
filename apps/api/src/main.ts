import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { API_VERSION_PREFIX } from "@foodscanner/shared";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);
  const port = config.get("PORT", { infer: true });

  app.setGlobalPrefix(API_VERSION_PREFIX.replace(/^\//, ""), {
    exclude: ["health"],
  });

  await app.listen(port);
  Logger.log(`API listening on http://127.0.0.1:${port}`);
}

void bootstrap();
