process.env.WORKER_MODE = "true";

async function bootstrap() {
  const { Logger } = await import("@nestjs/common");
  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("./app.module");
  await NestFactory.createApplicationContext(AppModule);
  Logger.log(
    "Worker process started (extraction, notification, promote, rescore, DLQ)"
  );
}

void bootstrap();
