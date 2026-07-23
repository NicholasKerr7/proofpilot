# Staging Deployment

ProofPilot staging uses Vercel for `apps/web` and one Railway staging environment for the API, worker, PostgreSQL, Redis, private object storage, and ClamAV.

This topology keeps the worker and malware scanner off serverless runtimes, keeps database and queue traffic on Railway's private network, and gives the web app a stable public API origin.

## Cost And Security Gate

Do not accept real evidence until ClamAV is running and `GET /health/ready` succeeds with `VIRUS_SCAN_MODE=clamav`.

The official ClamAV container guidance recommends 4 GB RAM because signature reloads can temporarily use substantially more memory than the steady state. Railway bills compute by usage. Set a workspace hard limit and an alert before creating the scanner service.

- Railway pricing: <https://railway.com/pricing>
- Railway cost controls: <https://docs.railway.com/pricing/cost-control>
- ClamAV container requirements: <https://docs.clamav.net/manual/Installing/Docker.html>

## Railway Topology

Create a project named `proofpilot` with a `staging` environment in one region. Add these resources only after the cost gate above is approved:

| Resource | Railway type | Public access | Notes |
| --- | --- | --- | --- |
| `api` | GitHub service | Yes | Config path `/deploy/railway/api.json`; expose port `4000` |
| `worker` | GitHub service | No | Config path `/deploy/railway/worker.json`; one replica |
| `Postgres` | PostgreSQL | No | Use its private `DATABASE_URL` |
| `Redis` | Redis | No | Use its private `REDIS_URL` |
| `evidence-bucket` | Bucket | Presigned URLs only | Keep the bucket private |
| `clamav` | Docker image service | No | Image `clamav/clamav:1.4`; port `3310`; 4 GB RAM |

Attach a volume to `clamav` at `/var/lib/clamav` so signature updates survive deploys. Keep the service on Railway's private network and do not add a TCP proxy or public domain.

Railway builds the repository's final Docker stage for both code services. The checked-in service configs override the start command so `api` runs NestJS and `worker` runs BullMQ from the same tested build artifact.

## Shared Variables

Share these variables with `api` and `worker`:

```dotenv
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
STORAGE_ENDPOINT=${{evidence-bucket.ENDPOINT}}
STORAGE_REGION=${{evidence-bucket.REGION}}
STORAGE_BUCKET=${{evidence-bucket.BUCKET}}
STORAGE_ACCESS_KEY_ID=${{evidence-bucket.ACCESS_KEY_ID}}
STORAGE_SECRET_ACCESS_KEY=${{evidence-bucket.SECRET_ACCESS_KEY}}
STORAGE_FORCE_PATH_STYLE=false
```

Use the URL style shown in the bucket Credentials tab if it differs from the current virtual-hosted default.

## API Variables

Set these only on `api`:

```dotenv
PORT=4000
WEB_ORIGIN=https://REPLACE_WITH_VERCEL_PREVIEW_OR_CUSTOM_DOMAIN
JWT_SECRET=REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS
AUTH_SESSION_TTL_DAYS=7
PASSWORD_RESET_DELIVERY_MODE=resend
PACKET_SHARE_EMAIL_DELIVERY_MODE=resend
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS=60
RESEND_API_KEY=REPLACE_WITH_STAGING_RESEND_KEY
AUTH_EMAIL_FROM=ProofPilot <security@REPLACE_WITH_VERIFIED_DOMAIN>
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
TRUST_PROXY=true
ERROR_MONITORING_ENVIRONMENT=staging
VIRUS_SCAN_MODE=clamav
CLAMAV_HOST=clamav.railway.internal
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=60000
```

Generate `JWT_SECRET` locally with `openssl rand -base64 48`. Seal it after creation. Never reuse the local or production secret.

## Worker Variables

Set these only on `worker`:

```dotenv
WEB_ORIGIN=https://REPLACE_WITH_VERCEL_PREVIEW_OR_CUSTOM_DOMAIN
JWT_SECRET=REPLACE_WITH_THE_SAME_API_SECRET
PACKET_SHARE_EMAIL_DELIVERY_MODE=resend
NOTIFICATION_EMAIL_DELIVERY_MODE=resend
RESEND_API_KEY=REPLACE_WITH_STAGING_RESEND_KEY
AUTH_EMAIL_FROM=ProofPilot <updates@REPLACE_WITH_VERIFIED_DOMAIN>
OCR_LANGUAGES=eng
OCR_CACHE_PATH=/tmp/proofpilot-ocr
```

Keep exactly one worker replica while the reminder, notification-email, and upload-cleanup schedulers are enabled. BullMQ processing can scale later after scheduler ownership is separated or explicitly coordinated.

## Bucket CORS

The browser uploads directly to short-lived signed URLs. Configure the private bucket to allow only the deployed web origin:

```json
[
  {
    "AllowedOrigins": ["https://REPLACE_WITH_VERCEL_PREVIEW_OR_CUSTOM_DOMAIN"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

The worker's hourly `upload-cleanup` scheduler removes database-tracked objects under `users/*/cases/*/upload-staging/` after 24 hours and retries transient deletion failures. Railway's lack of lifecycle rules is therefore not a staging blocker. For production, prefer a provider lifecycle rule as defense in depth for untracked objects and extended worker downtime.

## Provisioning Order

1. Authenticate the Railway CLI and create the `proofpilot` project and `staging` environment.
2. Add PostgreSQL, Redis, `evidence-bucket`, and the private `clamav` image service.
3. Connect this GitHub repository to separate `api` and `worker` services and assign the checked-in config paths.
4. Verify a staging sender domain in Resend and add shared and service-specific variables without deploying staged changes yet.
5. Create a Railway public domain for `api` on port `4000`.
6. Deploy the Vercel web preview with `NEXT_PUBLIC_API_URL=https://REPLACE_WITH_RAILWAY_API_DOMAIN`.
7. Set `WEB_ORIGIN` and bucket CORS to the exact Vercel origin, then deploy all Railway staged changes.
8. Verify the private bucket with `pnpm storage:bootstrap` through `railway run`.
9. Seed only the controlled staging environment with `pnpm db:seed` through `railway run`.

## Release Verification

Run these checks after both origins are stable:

```bash
curl --fail https://REPLACE_WITH_RAILWAY_API_DOMAIN/health
curl --fail https://REPLACE_WITH_RAILWAY_API_DOMAIN/health/ready
curl --fail https://REPLACE_WITH_RAILWAY_API_DOMAIN/health/queues

PROOFPILOT_API_URL=https://REPLACE_WITH_RAILWAY_API_DOMAIN \
  pnpm smoke:packet
```

Then run Playwright against the deployed origins:

```bash
PROOFPILOT_E2E_WEB_URL=https://REPLACE_WITH_VERCEL_PREVIEW_OR_CUSTOM_DOMAIN \
PROOFPILOT_E2E_API_URL=https://REPLACE_WITH_RAILWAY_API_DOMAIN/health \
  pnpm test:e2e
```

The staging gate is complete only when API readiness, all six queue health entries, private upload, ClamAV promotion, worker processing, notification and packet-share email delivery, upload cleanup, packet generation, signed download, and responsive browser tests all pass.
