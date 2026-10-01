const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * fetch() with a hard deadline — a hung upstream (OFF, OpenRouter, Anthropic,
 * anything else later) should never tie up a worker job or an HTTP request
 * indefinitely. Generic on purpose: any outbound call in this codebase
 * should go through this rather than bare fetch().
 */
export function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
}
