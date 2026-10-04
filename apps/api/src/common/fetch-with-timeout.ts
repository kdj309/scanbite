const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * fetch() with a hard deadline — a hung upstream (OFF, OpenRouter, Anthropic,
 * anything else later) should never tie up a worker job or an HTTP request
 * indefinitely. Generic on purpose: any outbound call in this codebase
 * should go through this rather than bare fetch().
 *
 * Uses a manual AbortController + setTimeout rather than AbortSignal.timeout()
 * — confirmed via a real Node 22.23.3 run that AbortSignal.timeout() has a
 * test-runner interaction bug there (an aborted fetch gets flagged
 * "Promise resolution is still pending but the event loop has already
 * resolved", cancelling the test) that this codebase's CI pins to. Node 26
 * doesn't exhibit it. This pattern is confirmed clean on both.
 */
export function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}
