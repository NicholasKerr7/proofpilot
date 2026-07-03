# Deployment

ProofPilot runs as three production services:

- `apps/web`: Next.js frontend, intended for Vercel.
- `apps/api`: NestJS API, container target `api`.
- `apps/worker`: BullMQ document processor, container target `worker`.

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

Image OCR uses Tesseract.js in the worker service. Give `OCR_CACHE_PATH` writable storage so language data can be reused between jobs; for locked-down production networks, provide `TESSERACT_LANG_PATH` instead of relying on the default language-data download path.

Set this for the web service:

- `NEXT_PUBLIC_API_URL`

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

Run Prisma schema setup before first production traffic:

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

For production migrations, replace `db:push` with generated Prisma migrations before launch.

## Health Checks

The API exposes:

```txt
GET /health
```

Use this endpoint for platform health checks and load balancer probes.

## Local Smoke Test

After `pnpm db:seed`, use the seeded demo account:

- Email: `nicholas.kerr@proofpilot.test`
- Password: `Password123!`
