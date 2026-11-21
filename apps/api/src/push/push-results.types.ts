import type { PushResult } from "./push-sender";

/** What Expo said about one push, by device token. */
export type PushAttempt = { token: string; result: PushResult };
