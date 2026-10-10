import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Expo,
  type ExpoPushReceipt,
  type ExpoPushTicket,
} from "expo-server-sdk";
import type { Env } from "../config/env";
import { PushSender, type PushMessage, type PushResult } from "./push-sender";

/** Android shows these under the "Product updates" channel the app creates. */
const ANDROID_CHANNEL = "product-updates";
/** A day-old "your product is ready" isn't worth delivering. */
const TTL_SECONDS = 24 * 60 * 60;

/**
 * Expo Push Service through Expo's SDK, which batches (100/request),
 * gzips, throttles and retries 429s for us.
 */
@Injectable()
export class ExpoPushSender extends PushSender {
  private readonly expo: Expo;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.expo = new Expo({
      accessToken: config.get("EXPO_ACCESS_TOKEN", { infer: true }),
    });
  }

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of this.expo.chunkPushNotifications(
      messages.map((message) => ({
        ...message,
        sound: "default" as const,
        priority: "high" as const,
        channelId: ANDROID_CHANNEL,
        ttl: TTL_SECONDS,
      }))
    )) {
      tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
    }
    return tickets.map(toResult);
  }

  async receipts(ticketIds: string[]): Promise<Record<string, PushResult>> {
    const results: Record<string, PushResult> = {};
    for (const chunk of this.expo.chunkPushNotificationReceiptIds(ticketIds)) {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
      for (const [id, receipt] of Object.entries(receipts)) {
        results[id] = toResult(receipt);
      }
    }
    return results;
  }
}

function toResult(answer: ExpoPushTicket | ExpoPushReceipt): PushResult {
  if (answer.status === "ok") {
    return { status: "ok", id: "id" in answer ? answer.id : undefined };
  }
  return {
    status: "error",
    error: answer.details?.error,
    message: answer.message,
  };
}
