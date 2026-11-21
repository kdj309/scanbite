# ScanBite mobile

Expo (SDK 57) app with Expo Router. Server data goes through TanStack Query;
API types and validation come from `@foodscanner/shared`.

## Run

From the repo root, with the API running (`apps/api`):

```bash
pnpm dev:mobile
```

This builds `packages/shared` once and starts the Expo dev server. Open it in
Expo Go or a development build.
When you're changing `packages/shared`, keep it rebuilding in a second
terminal with `pnpm --filter @foodscanner/shared dev`.

The app talks to `http://localhost:3000` by default, which works on a
simulator. On a physical phone, point it at your computer's LAN address in
`apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
```

## Layout

- `src/app/` — screens (Expo Router routes) only
- `src/api/` — `api()` client: auth header, single-flight token refresh,
  responses parsed with the shared schemas; tokens in `expo-secure-store`
- `src/session/` — creates an anonymous account on first open
- `src/query/` — the QueryClient, wired to app focus and network status

Push notifications need a development build (Expo Go has no push since SDK 53).
