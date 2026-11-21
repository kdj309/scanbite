import type { BullmqConnection } from "./redis-connection.types";

export function bullmqConnection(redisUrl: string): BullmqConnection {
  const parsed = new URL(redisUrl);
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: username ? username : undefined,
    password: password ? password : undefined,
    maxRetriesPerRequest: null,
  };
}
