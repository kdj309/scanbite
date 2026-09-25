import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);
  Logger.log(
    "Worker process started (queue processors are wired in a later task)",
  );
}

void bootstrap();
