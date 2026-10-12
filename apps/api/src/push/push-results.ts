import type { PushResult } from "./push-sender";

export type SentTicket = { id: string; token: string };

export type PushOutcome = {
  /** Accepted by Expo — check their receipts later. */
  sent: SentTicket[];
  /** App uninstalled or token dead: stop sending to these. */
  deadTokens: string[];
  /** Expo says slow down for these phones. */
  rateLimited: string[];
  /** Our setup is wrong (FCM/APNs credentials, bad request): never the
   *  phone's fault, so its token must NOT be deleted. */
  setupErrors: string[];
};

/**
 * Sorts Expo's answers (tickets now, or receipts ~15 min later) into what
 * we do about them.
 */
export function classifyPushResults(
  results: Array<{ token: string; result: PushResult }>
): PushOutcome {
  const outcome: PushOutcome = {
    sent: [],
    deadTokens: [],
    rateLimited: [],
    setupErrors: [],
  };
  for (const { token, result } of results) {
    if (result.status === "ok") {
      if (result.id) {
        outcome.sent.push({ id: result.id, token });
      }
    } else if (result.error === "DeviceNotRegistered") {
      outcome.deadTokens.push(token);
    } else if (result.error === "MessageRateExceeded") {
      outcome.rateLimited.push(token);
    } else {
      outcome.setupErrors.push(`${result.error ?? "error"}: ${result.message}`);
    }
  }
  return outcome;
}
