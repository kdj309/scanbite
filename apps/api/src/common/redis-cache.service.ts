import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { Env } from "../config/env";

/**
 * Generic Redis-backed cache primitives — one shared connection for the
 * whole app. Domain-specific caches (verdicts today, anything else later)
 * should depend on this rather than each opening their own Redis client
 * and re-implementing get/set/pattern-delete.
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Redis(config.get("REDIS_URL", { infer: true }));
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  /**
   * Deletes every key matching a glob-style SCAN pattern (e.g. "foo:*").
   * Uses SCAN, not KEYS, so it doesn't block Redis while walking the
   * keyspace.
   */
  async deleteByPattern(pattern: string): Promise<void> {
    const stream = this.client.scanStream({ match: pattern, count: 100 });
    const keys: string[] = [];
    for await (const chunk of stream) {
      keys.push(...(chunk as string[]));
    }
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
