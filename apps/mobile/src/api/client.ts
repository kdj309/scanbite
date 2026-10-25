import { authTokenResponseSchema } from "@foodscanner/shared";
import { API_BASE_URL } from "./config";
import {
  clearTokens,
  readTokens,
  saveTokens,
  type StoredTokens,
} from "./token-store";

/** Any shared zod schema; the app never needs zod itself. */
type Parser<T> = { parse(data: unknown): T };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** The refresh token was rejected; the stored session is gone. */
export class SessionExpiredError extends Error {}

/** Refresh a little early so a request never leaves with a dying token. */
const EXPIRY_MARGIN_MS = 30_000;

/** React Native's fetch never gives up on its own (think: a shop basement). */
const REQUEST_TIMEOUT_MS = 15_000;

async function send(
  path: string,
  init: { method?: string; body?: unknown },
  accessToken?: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Files go as multipart: fetch sets that content type (and its boundary).
  const json = init.body !== undefined && !(init.body instanceof FormData);
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(json && { "Content-Type": "application/json" }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: json
        ? JSON.stringify(init.body)
        : (init.body as FormData | undefined),
      signal: controller.signal,
    });
  } catch (error) {
    if (__DEV__) {
      // Kept for us: a bug here would otherwise look like a bad connection.
      console.warn(`${init.method ?? "GET"} ${path} failed`, error);
    }
    // Offline, server down or too slow: the raw error ("fetch failed:
    // UnexpectedException…") means nothing to the person, so say what to do.
    throw new Error("Check your connection and try again.", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

/** The API's message; React Native leaves statusText empty, so no fallback
 *  to it. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const { message } = (await response.json()) as { message?: unknown };
    if (typeof message === "string" && message) {
      return message;
    }
  } catch {
    // not JSON
  }
  return `Request failed (HTTP ${response.status})`;
}

/** First open: a silent account, so the household is saved from the start. */
export async function signInAnonymously(): Promise<StoredTokens> {
  const response = await send("/auth/anonymous", { method: "POST" });
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  return saveTokens(authTokenResponseSchema.parse(await response.json()));
}

let refreshing: Promise<StoredTokens> | null = null;

/**
 * One refresh at a time. Refresh tokens are single-use and the API revokes
 * every session when an old one is reused, so parallel requests that all
 * hit 401 must share this refresh, not each send the same token.
 */
function refreshTokens(stale: StoredTokens): Promise<StoredTokens> {
  refreshing ??= (async () => {
    const current = await readTokens();
    if (!current) {
      throw new SessionExpiredError();
    }
    if (current.access_token !== stale.access_token) {
      return current; // someone else already refreshed
    }
    const response = await send("/auth/refresh", {
      method: "POST",
      body: { refresh_token: current.refresh_token },
    });
    if (response.status === 401) {
      await clearTokens();
      throw new SessionExpiredError();
    }
    if (!response.ok) {
      throw new ApiError(response.status, await errorMessage(response));
    }
    return saveTokens(authTokenResponseSchema.parse(await response.json()));
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function validTokens(): Promise<StoredTokens> {
  const tokens = await readTokens();
  if (!tokens) {
    throw new SessionExpiredError();
  }
  return tokens.expires_at - EXPIRY_MARGIN_MS > Date.now()
    ? tokens
    : refreshTokens(tokens);
}

/** An authenticated API call, parsed with the shared contract. */
export async function api<T>(
  path: string,
  schema: Parser<T>,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const tokens = await validTokens();
  let response = await send(path, init, tokens.access_token);
  if (response.status === 401) {
    const renewed = await refreshTokens(tokens);
    response = await send(path, init, renewed.access_token);
  }
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  return schema.parse(
    response.status === 204 ? undefined : await response.json()
  );
}
