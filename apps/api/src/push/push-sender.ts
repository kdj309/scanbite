/** One notification to one phone. */
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

/** Expo's error codes; see push-results.ts for how each is handled. */
export type PushError =
  | "DeviceNotRegistered"
  | "MessageRateExceeded"
  | "MessageTooBig"
  | "InvalidCredentials"
  | "DeveloperError"
  | "ExpoError"
  | "ProviderError";

/** Expo's answer per message (a ticket) or per ticket later (a receipt). */
export type PushResult =
  | { status: "ok"; id?: string }
  | { status: "error"; error?: PushError; message: string };

/** Port for the push service, so tests and local dev never send for real. */
export abstract class PushSender {
  /** Tickets, in the same order as `messages`. Throws on transport errors. */
  abstract send(messages: PushMessage[]): Promise<PushResult[]>;
  /** Receipts by ticket id; ids Expo doesn't know yet are left out. */
  abstract receipts(ticketIds: string[]): Promise<Record<string, PushResult>>;
}
