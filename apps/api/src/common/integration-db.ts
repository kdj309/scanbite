import mongoose from "mongoose";

/** Integration tests (*.itest.ts) only. Defaults match docker-compose. */
const MONGO_URI =
  process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27018/foodscanner_test";
export const TEST_REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

/**
 * Connects to a fresh database of its own — node --test runs test files in
 * parallel, so files must not share one. Indexes are rebuilt because the
 * unique ones are part of what's tested.
 */
export async function connectTestDb(dbName: string): Promise<void> {
  await mongoose.connect(MONGO_URI, { dbName });
  await mongoose.connection.dropDatabase();
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.syncIndexes())
  );
}

export async function dropTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
