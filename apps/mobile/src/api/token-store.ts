import type { AuthTokenResponse } from "@foodscanner/shared";
import * as SecureStore from "expo-secure-store";

const KEY = "scanbite.session";

export type StoredTokens = {
  access_token: string;
  refresh_token: string;
  /** Epoch ms when the access token stops working. */
  expires_at: number;
};

export async function readTokens(): Promise<StoredTokens | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

export async function saveTokens(
  response: AuthTokenResponse
): Promise<StoredTokens> {
  const tokens: StoredTokens = {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: Date.now() + response.expires_in * 1000,
  };
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  return tokens;
}

export function clearTokens(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY);
}
