import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import type { ExpoPushMessage } from "expo-server-sdk";
import { ExpoPushSender } from "./expo-push-sender";

/** Swaps the SDK client for a recorder; Expo is never called. */
function senderWith(fake: object): ExpoPushSender {
  const sender = new ExpoPushSender(new ConfigService({}) as never);
  Object.assign(sender, { expo: fake });
  return sender;
}

describe("ExpoPushSender", () => {
  it("sends with our delivery settings and maps tickets", async () => {
    const sent: ExpoPushMessage[] = [];
    const sender = senderWith({
      chunkPushNotifications: (messages: ExpoPushMessage[]) => [messages],
      sendPushNotificationsAsync: async (chunk: ExpoPushMessage[]) => {
        sent.push(...chunk);
        return [
          { status: "ok", id: "ticket-1" },
          {
            status: "error",
            message: "gone",
            details: { error: "DeviceNotRegistered" },
          },
        ];
      },
    });

    const results = await sender.send([
      { to: "ExponentPushToken[a]", title: "T", body: "B", data: {} },
      { to: "ExponentPushToken[b]", title: "T", body: "B", data: {} },
    ]);

    assert.deepEqual(results, [
      { status: "ok", id: "ticket-1" },
      { status: "error", error: "DeviceNotRegistered", message: "gone" },
    ]);
    assert.deepEqual(
      [sent[0].sound, sent[0].priority, sent[0].channelId, sent[0].ttl],
      ["default", "high", "product-updates", 86400]
    );
  });

  it("collects receipts across chunks", async () => {
    const sender = senderWith({
      chunkPushNotificationReceiptIds: () => [["r1"], ["r2"]],
      getPushNotificationReceiptsAsync: async ([id]: string[]) => ({
        [id]:
          id === "r1"
            ? { status: "ok" }
            : {
                status: "error",
                message: "gone",
                details: { error: "DeviceNotRegistered" },
              },
      }),
    });
    assert.deepEqual(await sender.receipts(["r1", "r2"]), {
      r1: { status: "ok", id: undefined },
      r2: { status: "error", error: "DeviceNotRegistered", message: "gone" },
    });
  });
});
