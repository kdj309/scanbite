import { Injectable, Logger } from "@nestjs/common";
import { PushSender, type PushMessage, type PushResult } from "./push-sender";

/** PUSH_PROVIDER=noop: logs what would be sent (local dev, tests). */
@Injectable()
export class NoopPushSender extends PushSender {
  private readonly logger = new Logger(NoopPushSender.name);

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    for (const message of messages) {
      this.logger.log(`push (not sent) "${message.title}" — ${message.body}`);
    }
    return messages.map(() => ({ status: "ok" }));
  }

  async receipts(): Promise<Record<string, PushResult>> {
    return {};
  }
}
