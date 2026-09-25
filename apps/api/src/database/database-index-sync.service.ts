import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

@Injectable()
export class DatabaseIndexSyncService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseIndexSyncService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    const models = Object.values(this.connection.models);
    await Promise.all(models.map((model) => model.syncIndexes()));
    this.logger.log(
      `Synced indexes for ${models.length} collections: ${models
        .map((model) => model.collection.collectionName)
        .sort()
        .join(", ")}`,
    );
  }
}
