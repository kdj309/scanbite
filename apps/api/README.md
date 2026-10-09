# ScanBite API

Backend for a packaged-food label scanner (India). You scan or photograph a
barcode, the API returns a green/yellow/red verdict with reasons, and the
verdict is personalized against a household member's health conditions
(diabetic, hypertensive, etc.).

NestJS + MongoDB + Redis + S3-compatible storage (MinIO locally), BullMQ for
background jobs. One process runs the HTTP API; a second process (same
codebase, `WORKER_MODE=true`) runs the queue workers.

## Prerequisites

- Node 22+, pnpm
- Docker (for Mongo, Redis, MinIO)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

Fill in `apps/api/.env`. For local dev the values matching the
`docker-compose.yml` services are:

```
MONGODB_URI=mongodb://127.0.0.1:27018/foodscanner
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=7d
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY=<matches MINIO_ROOT_USER in docker-compose.yml>
S3_SECRET_KEY=<matches MINIO_ROOT_PASSWORD in docker-compose.yml>
S3_BUCKET=foodscanner-labels
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

Note the docker-compose Mongo is mapped to host port **27018**, not the
default 27017 — that's deliberate, to avoid colliding with a Mongo you might
already have running locally.

Start the infra and the API:

```bash
pnpm compose:up
pnpm --filter api dev
```

On boot in `development`, the API auto-seeds: the v1 rule set, one
personalization rule (diabetic + high sugar), and a fixture product at
barcode `8900000000000` — enough to try the whole flow with zero external
data. Real product data (Open Food Facts India import, ~1,900 products) is a
separate, one-time step — see [Seed scripts](#seed-scripts) below.

To run the worker (extraction/promote/rescore/notification/DLQ processors),
run a second process:

```bash
pnpm --filter api worker
```

(`worker.ts` sets `WORKER_MODE=true` itself before bootstrapping — same
`AppModule`, it just also registers the queue processors. Running `dev`
without this does not process any jobs; submissions will sit at
`processing` forever.)

## Trying it

There's a Postman collection at `postman/ScanBite-API.postman_collection.json`
covering every route below — "Create anonymous account" auto-captures the
tokens and default `member_id` into collection variables, so you can just run
requests top to bottom after that. Or use curl:

Health check (Mongo, Redis, S3 — all three are real dependencies now, not
stubs):

```bash
curl http://localhost:3000/health
```

Create an account and grab a token (this is what the app does on first open):

```bash
curl -X POST http://localhost:3000/v1/auth/anonymous \
  -H 'Content-Type: application/json' -d '{}'
```

Every new account gets a default "self" household member automatically —
you don't need a separate call for that. Use the `access_token` from the
response as a bearer token for everything below. It lasts 15 minutes; swap
the `refresh_token` for a new pair with `POST /v1/auth/refresh`.

Signing in with Google/Apple (`POST /v1/auth/google`, `/v1/auth/apple`) needs
a real ID token from the phone's sign-in SDK plus the client IDs/keys in
`.env` (see `.env.example`); without them those routes answer 503. There's no
password sign-in. Admin access comes from signing in with Google as
`ADMIN_EMAIL` (or setting `role: "admin"` on a user in Mongo).

Delete the account and everything tied to it:

```bash
curl -X DELETE http://localhost:3000/v1/me -H "Authorization: Bearer $TOKEN"
```

Look up the seeded fixture product:

```bash
curl http://localhost:3000/v1/products/8900000000000 \
  -H "Authorization: Bearer $TOKEN"
```

An unknown barcode returns `{"found": false}` rather than a 404 — that's the
documented shape, not a bug.

Submit a label photo for a new/changed product (returns 202, processed async
by the worker):

```bash
curl -X POST http://localhost:3000/v1/products/1234567890123/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -F photo=@/path/to/label.jpg

curl http://localhost:3000/v1/submissions/<id> \
  -H "Authorization: Bearer $TOKEN"
```

Status goes `processing` → `ready` (or `needs_review` / `failed`) once the
worker picks it up — the worker process has to actually be running for this
to move.

Log a scan and check the household summary:

```bash
curl -X POST http://localhost:3000/v1/scans \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"barcode":"8900000000000"}'

curl "http://localhost:3000/v1/household-members/<member_id>/summary?period=week" \
  -H "Authorization: Bearer $TOKEN"
```

## Known limitations (current, not aspirational)

- **Vision extraction is stubbed.** `VISION_PROVIDER=stub` returns a canned
  extraction regardless of the actual photo. Real Qwen-VL / Claude wiring is
  planned but not built yet — see the HLD §9 note on that decision still
  being empirically unvalidated.
- **Notifications are a no-op** (logged, not sent). No push/SMS provider is
  wired up.
- **Alias resolution layers 2 and 3** (similarity/embedding matching) are
  interfaces only — always return no match. Only layer 1 (exact/alias-table
  lookup) does real work today.
- **Google/Apple sign-in can't be exercised locally** without real client
  IDs and an ID token from a device; the linking logic is covered by unit
  tests and the `smoke-auth` script instead.

None of these are silent — they're either explicit stub classes or
documented in `docs/designs/scanbite-implementation-progress.md`.

## Seed scripts

Everything here lives in `src/admin/` and is run directly with `tsc` (they
don't go through Nest's DI):

```bash
pnpm exec tsc -p tsconfig.json
node dist/admin/<script>.js
```

Actual data seeding/migration:

- `seed.ts` — bulk-imports the Open Food Facts India seed collection into
  `products`/`product_versions`/`ingredients`/`ingredient_aliases`. Reads
  from a separate `off` database (`off_india_seed` collection) that has to
  already exist — this is not something `docker-compose` sets up for you.
- `deletebaddata.ts` — targeted re-seed for a specific past data bug
  (nutrition values mis-parsed from a non-per-100g source).
- `backfill-liquid-nutrition.ts` — additive backfill for products whose
  sugar/sodium were reported per-100ml (drinks) rather than per-100g.

Diagnostics (read-only unless noted, safe to run anytime):

- `score-sample.ts` — runs the real evaluator against a handful of known
  barcodes and prints the verdict + reasons.
- `rule-impact.ts` — runs the active rule set against every live product and
  reports severity distribution and per-rule fire counts.
- `smoke-*.ts` — one per infrastructure piece (Redis cache, S3 storage,
  personalization, scans, job queues, alias normalization). Each hits the
  real local Mongo/Redis/MinIO and cleans up after itself. Useful after
  touching that piece of infra to confirm it still actually works, not just
  compiles.

## Tests

```bash
pnpm --filter api build
pnpm --filter api test
```

Tests are plain `node --test` against compiled output — no separate test
runner config. They cover pure logic (rules evaluation, conflict detection,
personalization, alias resolution) with hand-built fakes, not a real
database connection.

## Layout

```
src/
  auth/            anonymous + Google/Apple sign-in, refresh tokens, account
                   deletion, Apple notifications, JWT guard, roles guard
  household/       household member CRUD, ownership checks
  products/        GET /products/:barcode — the read path
  submissions/     photo upload -> extraction queue
  scans/           scan history + household summary
  scoring/         rules-as-data evaluator, active rule set resolution
  personalization/ per-member condition overlay on top of base scoring
  alias/           ingredient text -> canonical ingredient resolution
  consensus/       pending vs. live product version promotion
  workers/         BullMQ processors, vision port + stub adapter, seed data
  admin/           unresolved-ingredient triage API + one-off scripts
  health/          /health — pings Mongo, Redis, and S3
  common/          Redis cache, S3 storage, shared Mongo/error helpers
  database/        Mongoose schemas
```
