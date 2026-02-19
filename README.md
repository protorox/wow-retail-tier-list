# WoW Retail Tier List

Production-oriented Next.js app that generates live, data-driven tier lists for WoW Retail from:
- Mythic+: Warcraft Logs v2 (OAuth + GraphQL)
- Raid: Warcraft Logs v2 (OAuth + GraphQL)

The UI renders separate tier lists for Mythic+ and Raid, each split by role (DPS, Tank, Healer) with spec details, build aggregation, stat priority derivation, and evidence links.

## Deploy Online (Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/protorox/wow-retail-tier-list)

This repo includes a `render.yaml` Blueprint that provisions:
- web service
- worker service
- PostgreSQL
- Redis

Default Blueprint env uses `MOCK_MODE=false` for live data.
Default admin credentials in Blueprint are `admin` / `admin` (change after first deploy).
You must provide Warcraft Logs credentials:
- `WARCRAFTLOGS_CLIENT_ID`
- `WARCRAFTLOGS_CLIENT_SECRET`
To use local fixtures instead, set `MOCK_MODE=true`.

## Stack

- TypeScript everywhere
- Next.js App Router + Tailwind CSS
- shadcn-style UI components (tabs, cards, drawer)
- Prisma + PostgreSQL
- Redis + BullMQ
- Dedicated worker process
- Docker Compose for local full stack

## Features

- Snapshot-based tier lists for:
  - `MYTHIC_PLUS`
  - `RAID`
- Role sub-tabs for each mode:
  - `DPS`, `TANK`, `HEALER`
- Tiers (configurable):
  - `S`, `A+`, `A`, `B+`, `B`, `C`
- Spec detail drawer includes:
  - Most common build from top-performer dataset
  - Import string copy button (if available)
  - Data-driven stat priority + medians
  - Evidence links back to source pages
- Observability:
  - Structured logs
  - `JobRun` history (`running/success/failed`, duration, updated count)
- Admin page (`/admin`, basic auth):
  - Manual refresh trigger
  - AppConfig JSON edit + validation
  - Latest refresh logs
- Mock mode with fixture JSON (`fixtures/*.json`) so the UI works without API keys

## Project Structure

```
app/
  admin/page.tsx
  api/
    admin/
    cron/refresh/
    refresh/
    tier/
  layout.tsx
  page.tsx
components/
  admin/
  tier/
  ui/
prisma/
  migrations/
  schema.prisma
  seed.ts
src/
  lib/
  server/
    aggregation/
    config/
    db/
    jobs/
    logger.ts
    providers/
    queue/
    scoring/
    types/
worker/
  src/index.ts
fixtures/
  mythic-plus.json
  raid.json
tests/
```

## Environment

Copy and edit:

```bash
cp .env.example .env
```

Key vars:
- `DATABASE_URL`
- `REDIS_URL`
- `MOCK_MODE=false` (default, set `true` to use fixture JSON)
- `RAIDER_IO_BASE_URL`
- `WARCRAFTLOGS_CLIENT_ID`
- `WARCRAFTLOGS_CLIENT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `CRON_SECRET`
- `WORKER_MODE=interval|cron`
- `REFRESH_INTERVAL_MINUTES=30`

## Local Run

### Option A: Full Docker Compose

```bash
docker compose up --build
```

This starts `web`, `worker`, `postgres`, and `redis`.

### Option B: Local app + containerized infra

1. Start infrastructure:

```bash
docker compose up postgres redis
```

2. Install dependencies:

```bash
npm install
```

3. Apply migrations:

```bash
npm run prisma:deploy
```

4. Start web app:

```bash
npm run dev
```

5. Start worker (separate terminal):

```bash
npm run worker
```

6. (Optional) seed immediately:

```bash
npm run seed
```

## Scheduling Modes

### Dev mode (`WORKER_MODE=interval`)

Worker enqueues refresh every `REFRESH_INTERVAL_MINUTES` (default 30) and also at startup.

### Prod mode (`WORKER_MODE=cron`)

Worker only processes queued jobs. Use external cron to hit:

- `POST /api/cron/refresh`
- Provide `x-cron-secret: <CRON_SECRET>`

Compatible with Vercel Cron, GitHub Actions, or generic cron.

## Scoring + Tiering

Configuration lives in `AppConfig.configJson`.

### Mythic+ scoring

1. Pull Mythic+ character rankings from Warcraft Logs dungeon zone encounters.
2. Group by `(role, class, spec)`.
3. For each spec, take top `N` (default `200`) entries from the larger paged ranking sample.
4. Compute adjusted metric per run:
   - `keyLevel + timedBonus` (timed)
   - `keyLevel + overtimePenalty` (overtime)
5. Use median adjusted level as raw score.
6. Normalize raw scores within each role to `0..100`.

### Raid scoring

1. Pull rankings from Warcraft Logs GraphQL for configured zone/difficulty.
2. Group by `(role, class, spec)`.
3. Take top `N` (default `200`) entries.
4. Use configured percentile (default `0.95`) as raw score.
5. Normalize raw scores within each role to `0..100`.

### Tier mapping

Default cutoffs:
- `S`: `>= 95`
- `A+`: `90 - 94.99`
- `A`: `80 - 89.99`
- `B+`: `70 - 79.99`
- `B`: `60 - 69.99`
- `C`: `< 60`

All tier ranges are editable in `AppConfig`.

## Build + Stat Derivation

No guide scraping is used.

For each spec, from the same top-performer dataset:
- Build:
  - If import/build strings exist: choose modal string among top N.
  - Else fallback to per-node talent pick rates.
- Stats:
  - Aggregate available stat values.
  - Compute medians and priority ordering from highest to lowest median.
  - If source payload lacks stat data, return `Not available from source payloads`.

## API Endpoints

- `GET /api/tier?mode=MYTHIC_PLUS|RAID`
- `POST /api/refresh` (manual/protected)
- `POST /api/cron/refresh` (cron secret protected)
- `GET /api/admin/config` (basic auth)
- `POST /api/admin/config` (basic auth)
- `POST /api/admin/refresh` (basic auth)
- `GET /api/admin/logs` (basic auth)

## Tests

Run:

```bash
npm run test
```

Included unit tests:
- tier assignment
- normalization
- most common build derivation

## Notes

- API failures do not remove prior snapshots; app continues serving last successful data.
- Rate-limit safety includes:
  - Redis response caching
  - retries with exponential backoff + jitter on `429/5xx`
  - concurrency limiting for outbound calls
- The code is structured to make season/raid filters straightforward to add in UI and provider query params.
