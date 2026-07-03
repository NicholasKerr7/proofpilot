# Deployment

ProofPilot runs as three production services:

- `apps/web`: Next.js frontend, intended for Vercel.
- `apps/api`: NestJS API, container target `api`.
- `apps/worker`: BullMQ document processor and packet generator, container target `worker`.

## Required Runtime Services

- PostgreSQL
- Redis
- S3-compatible private storage, such as Cloudflare R2, AWS S3, or MinIO

## Required Environment Variables

Set these for the API service:

- `NODE_ENV=production`
- `PORT=4000`
- `WEB_ORIGIN`
- `JWT_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `STORAGE_REGION`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_ENDPOINT` when using S3-compatible storage outside AWS S3
- `STORAGE_FORCE_PATH_STYLE=true` when using MinIO or another path-style provider

Set these for the worker service:

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `STORAGE_REGION`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_ENDPOINT` when using S3-compatible storage outside AWS S3
- `STORAGE_FORCE_PATH_STYLE=true` when using MinIO or another path-style provider
- `OCR_LANGUAGES=eng`
- `OCR_CACHE_PATH=/tmp/proofpilot-ocr`
- `TESSERACT_LANG_PATH` optional path or URL for pre-hosted Tesseract traineddata files

Image OCR and packet PDF generation run in the worker service. Give `OCR_CACHE_PATH` writable storage so language data can be reused between jobs; for locked-down production networks, provide `TESSERACT_LANG_PATH` instead of relying on the default language-data download path.

Set this for the web service:

- `NEXT_PUBLIC_API_URL`

## Storage Setup

Create or verify the private evidence bucket before first API or worker traffic:

```bash
pnpm storage:bootstrap
```

The command loads `.env` and `.env.local`, uses the same `STORAGE_*` variables as the API and worker, and is idempotent. For production providers that do not allow application credentials to create buckets, pre-create `STORAGE_BUCKET` in the provider console and run the command as a verification step.

## Container Builds

Build the API image:

```bash
docker build --target api -t proofpilot-api .
```

Build the worker image:

```bash
docker build --target worker -t proofpilot-worker .
```

The Dockerfile intentionally uses separate `api` and `worker` targets from one monorepo build so both services share the same compiled workspace packages.

## Database Setup

Apply Prisma migrations before first production traffic:

```bash
pnpm db:generate
pnpm db:deploy
```

Run `pnpm db:seed` only for local demo or controlled staging data. The seed creates the demo Nicholas Kerr account and sample case records.

If an existing non-empty database was created before migrations with `pnpm db:push`, baseline it only after confirming the schema matches the initial migration:

```bash
pnpm --filter @proofpilot/database exec prisma migrate resolve --applied 20260703130000_init
```

## Health Checks

The API exposes:

```txt
GET /health
GET /health/queues
```

Use `GET /health` for platform health checks and load balancer probes. Use `GET /health/queues` for Redis and BullMQ operational checks. Queue operations guidance is in [operations.md](operations.md).

## Local Smoke Test

After `pnpm db:seed`, use the seeded demo account:

- Email: `nicholas.kerr@proofpilot.test`
- Password: `Password123!`

With PostgreSQL, Redis, MinIO, the bootstrapped storage bucket, the API, and the worker running, verify the authenticated packet queue and export flow:

```bash
pnpm smoke:packet
```

The smoke check uses `PROOFPILOT_API_URL=http://localhost:4000` by default. Override `PROOFPILOT_SMOKE_EMAIL`, `PROOFPILOT_SMOKE_PASSWORD`, `PROOFPILOT_SMOKE_TIMEOUT_MS`, `PROOFPILOT_SMOKE_KEEP_CASE=1`, or `PROOFPILOT_SMOKE_SKIP_DOWNLOAD=1` when needed.
