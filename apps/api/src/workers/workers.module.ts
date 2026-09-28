import { BullModule } from "@nestjs/bullmq";
import { Global, Module, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AliasModule } from "../alias/alias.module";
import { ConsensusModule } from "../consensus/consensus.module";
import type { Env } from "../config/env";
import { ScoringModule } from "../scoring/scoring.module";
import { ExtractionPipeline } from "./extraction.pipeline";
import { JobQueuesService } from "./job-queues.service";
import { NoopNotifier } from "./noop-notifier";
import { DlqProcessor } from "./processors/dlq.processor";
import { ExtractionProcessor } from "./processors/extraction.processor";
import { NotificationProcessor } from "./processors/notification.processor";
import { PromoteProcessor } from "./processors/promote.processor";
import { RescoreProcessor } from "./processors/rescore.processor";
import {
  QUEUE_DLQ,
  QUEUE_EXTRACTION,
  QUEUE_NOTIFICATION,
  QUEUE_PROMOTE,
  QUEUE_RESCORE,
} from "./queue-names";
import { bullmqConnection } from "./redis-connection";
import { SeedService } from "./seed/seed.service";
import { StubVisionAdapter } from "./vision/stub-vision.adapter";
import { VISION_PORT } from "./vision/vision.port";

function workerModeEnabled(): boolean {
  const raw = process.env.WORKER_MODE;
  return raw === "true" || raw === "1";
}

const processors: Provider[] = workerModeEnabled()
  ? [
      ExtractionProcessor,
      NotificationProcessor,
      PromoteProcessor,
      RescoreProcessor,
      DlqProcessor,
    ]
  : [];

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: bullmqConnection(config.get("REDIS_URL", { infer: true })),
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_EXTRACTION },
      { name: QUEUE_NOTIFICATION },
      { name: QUEUE_PROMOTE },
      { name: QUEUE_RESCORE },
      { name: QUEUE_DLQ }
    ),
    AliasModule,
    ScoringModule,
    ConsensusModule,
  ],
  providers: [
    JobQueuesService,
    StubVisionAdapter,
    { provide: VISION_PORT, useExisting: StubVisionAdapter },
    SeedService,
    ExtractionPipeline,
    NoopNotifier,
    ...processors,
  ],
  exports: [JobQueuesService],
})
export class WorkersModule {}
