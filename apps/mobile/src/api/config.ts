import { API_VERSION_PREFIX } from "@foodscanner/shared";

/**
 * Where the API runs. Simulators reach the dev machine on localhost; a
 * physical phone needs the machine's LAN address, e.g.
 * EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 in apps/mobile/.env.local.
 */
const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const API_BASE_URL = `${API_ORIGIN}${API_VERSION_PREFIX}`;
