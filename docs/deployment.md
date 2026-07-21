# Deployment

ProofPilot runs as three production services:

- `apps/web`: Next.js frontend, intended for Vercel.
- `apps/api`: NestJS API, container target `api`.
- `apps/worker`: BullMQ document processor, packet generator, and reminder scheduler, container target `worker`.

The provider-specific staging topology, Railway service configs, variable references, cost gate, and deployment order are documented in [staging-deployment.md](staging-deployment.md).

## Required Runtime Services

- PostgreSQL
- Redis
- S3-compatible private storage, such as Cloudflare R2, AWS S3, or MinIO
- A private ClamAV 1.4 LTS daemon reachable from the API

## Required Environment Variables

Set these for the API service:

- `NODE_ENV=production`
- `PORT=4000`
- `WEB_ORIGIN`
- `JWT_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `ERROR_MONITORING_ENVIRONMENT=production`
- `ERROR_MONITORING_WEBHOOK_URL` optional HTTPS webhook for sanitized 500-level API error events
- `RATE_LIMIT_MAX=120`
- `RATE_LIMIT_WINDOW_MS=60000`
- `TRUST_PROXY=true` when the API is behind a trusted reverse proxy or load balancer
- `STORAGE_REGION`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_ENDPOINT` when using S3-compatible storage outside AWS S3
- `STORAGE_FORCE_PATH_STYLE=true` when using MinIO or another path-style provider
- `VIRUS_SCAN_MODE=clamav`
- `CLAMAV_HOST` private ClamAV hostname or IP
- `CLAMAV_PORT=3310`
- `CLAMAV_TIMEOUT_MS=60000`

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

Image OCR, packet PDF generation, and reminder delivery run in the worker service. Keep at least one worker replica active so the idempotent `reminder-delivery` scheduler can enqueue its one-minute jobs. Give `OCR_CACHE_PATH` writable storage so language data can be reused between jobs; for locked-down production networks, provide `TESSERACT_LANG_PATH` instead of relying on the default language-data download path.

Set this for the web service:

- `NEXT_PUBLIC_API_URL`

## Billing Provider

The current billing foundation runs in demo mode and does not process payments. Plan and payment-method management return an explicit unavailable response until a payment provider is integrated. Do not switch persisted subscriptions to provider-backed mode until server-side checkout, customer portal sessions, signed webhooks, and environment-specific secrets are configured and tested.

## Account Security Providers

Every signed JWT contains an opaque database session ID. Protected requests require a matching, unexpired, non-revoked `AuthSession`; logout revokes the current session, password changes preserve only the verified current session, and password resets revoke every session. The Security & Privacy workspace can list up to ten active owner sessions and revoke individual or all other sessions.

Password recovery stores only SHA-256 token hashes, enforces one-time redemption and expiry, invalidates older links when a new one is issued, and returns the same acknowledgement for known and unknown addresses. Collaboration invitations use the same delivery configuration and also store hash-only, single-use tokens. Development logs reset and invitation links with `PASSWORD_RESET_DELIVERY_MODE=log`; production startup requires `PASSWORD_RESET_DELIVERY_MODE=resend`, `RESEND_API_KEY`, and a verified `AUTH_EMAIL_FROM` sender.

The web auth proxy forwards a sanitized browser user-agent for session display. API request context and forwarded headers remain informational only; authorization relies on the verified JWT, persisted session, and explicit resource ownership checks. IP geolocation is not performed. Two-factor enrollment and WebAuthn biometric enrollment remain unavailable until their credential and recovery flows are implemented end to end.

## Assistant Model Provider

The current assistant runs in guided mode and does not require or call an external AI provider. Case records and assistant messages remain in PostgreSQL, and the UI explicitly reports that model generation is unavailable.

Before enabling model-backed responses, add a server-only provider integration, explicit environment-specific secrets, user-facing data-transfer disclosure, retention controls, request redaction, model and token attribution, cost accounting, and provider-failure behavior. Never expose provider credentials to `apps/web`, and never change the capability flag until the complete flow has been tested with owner-scoped case data.

## Storage Setup

Create or verify the private evidence bucket before first API or worker traffic:

```bash
pnpm storage:bootstrap
```

The command loads `.env` and `.env.local`, uses the same `STORAGE_*` variables as the API and worker, and is idempotent. For production providers that do not allow application credentials to create buckets, pre-create `STORAGE_BUCKET` in the provider console and run the command as a verification step.

## Input Validation

The API's global validation pipe strips no unknown input silently: it rejects non-whitelisted fields and transforms only declared DTO values. Database-backed route parameters and resource IDs in queries, bodies, and ID arrays use the same bounded character rule. Malformed identifiers return `400` before ownership-aware database or private-storage lookups; a syntactically valid identifier never bypasses the authenticated owner filter.

Persisted user-authored content is plain text. DTO transforms normalize Unicode and line endings, remove markup, control characters, and bidirectional overrides, then run field length and nonblank validation against the sanitized value. Keep frontend output in React text nodes; web lint rejects `dangerouslySetInnerHTML`. Preserve context-specific defenses when adding an output format: CSV cells must remain formula-neutralized and PDF text must pass through the renderer's supported-character normalization.

Text extracted from uploaded evidence is intentionally preserved as source material. Never render extracted text as raw HTML, interpolate it into SQL, shell commands, or storage keys, or send it to a third-party model without the explicit provider controls described above.

## Access-Isolation Verification

Run `pnpm test:integration` against a migrated, seeded PostgreSQL database with Redis available. The suite starts the Nest application on an ephemeral local port, registers a temporary second user, builds a foreign case graph owned by the seeded account, and verifies guarded routes, owner-scoped collections, direct resources, and nested mutations. Cross-user access must return `404`, the protected database state must remain unchanged, and all temporary records are removed during teardown. CI runs this suite before browser tests.

## Upload Security

Evidence uploads are limited to PDF, PNG, JPG, JPEG, TXT, DOCX, EML, CSV, and XLSX files under 25 MB. The API validates the requested upload metadata before issuing a signed URL and validates the stored object size and content type before queueing document processing.

Invalid completed uploads are marked `FAILED`, logged as `upload_validation`, and are not queued. The API never issues download URLs while a document remains `UPLOADED`. After metadata validation, it streams the private staging object to ClamAV using `INSTREAM`. A clean result is conditionally copied by ETag to a deterministic processing key before the staging object is deleted and work is queued. This keeps a still-valid upload URL from replacing the bytes accepted by the scanner. Detected threats are quarantined, denied download and reprocessing access, and deleted from storage. Scanner or promotion errors return `503` without queueing work so the upload can be retried.

Configure a bucket lifecycle rule to expire objects under `users/*/cases/*/upload-staging/` after 24 hours. The API deletes staging objects after promotion, but the lifecycle rule removes abandoned reservations and objects recreated through unexpired signed URLs.

Production API startup rejects disabled scanning. Keep the ClamAV TCP socket on a private network because the protocol has no transport encryption or authentication. Size the scanner separately from the API; the [official ClamAV container guidance](https://docs.clamav.net/manual/Installing/Docker.html) recommends 4 GB RAM for current signature databases.

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

Run `pnpm db:seed` only for local demo or controlled staging data. The seed creates the demo Nicholas Kerr account, sample case records, and a guided assistant conversation.

If an existing non-empty database was created before migrations with `pnpm db:push`, baseline it only after confirming the schema matches the initial migration:

```bash
pnpm --filter @proofpilot/database exec prisma migrate resolve --applied 20260703130000_init
```

## Health Checks

The API exposes:

```txt
GET /health
GET /health/ready
GET /health/queues
```

Use `GET /health` as the dependency-free liveness probe that confirms the API process can serve HTTP. Use `GET /health/ready` for container health and load balancer readiness; it returns `503` when PostgreSQL or the Redis-backed queue connections cannot respond within three seconds. Use `GET /health/queues` for BullMQ backlog, paused-state, and retained-failure diagnostics. Queue failures are operational warnings rather than readiness failures unless the queue connection itself is unavailable. Queue operations guidance is in [operations.md](operations.md).

## Request Logging And Rate Limits

The API emits structured JSON request logs with method, path, status, duration, IP, user agent, and `x-request-id`. Request bodies and authorization headers are not logged.

Process-local rate limiting is enabled for API routes with `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS`; liveness, readiness, and queue-health endpoints are bypassed so platform probes are not throttled. For multi-instance production deployments, place a shared edge or gateway rate limiter in front of the API.

## Error Monitoring And Alerts

Unhandled API errors are normalized by a global exception filter. Client responses receive a sanitized `500` body with `x-request-id`; server logs receive a structured error event with service, environment, method, path, status, request ID, error name, message, and stack.

Set `ERROR_MONITORING_WEBHOOK_URL` to forward sanitized 500-level events to an external monitor or alert router. Configure alerts for repeated 500s, readiness failures from `GET /health/ready`, queue health degradation from `GET /health/queues`, and packet generation failures in worker logs.

## Accessibility And Responsive QA

Accessibility and responsive verification notes are in [accessibility.md](accessibility.md). Run the mobile, tablet, and desktop viewport checklist before production release and after major layout changes.

## Local Smoke Test

After `pnpm db:seed`, use the seeded demo account:

- Email: `nicholas.kerr@proofpilot.test`
- Password: `Password123!`

With PostgreSQL, Redis, MinIO, the bootstrapped storage bucket, the API, and the worker running, verify the authenticated packet queue and export flow:

```bash
pnpm smoke:packet
```

The smoke check uses `PROOFPILOT_API_URL=http://localhost:4000` by default. Override `PROOFPILOT_SMOKE_EMAIL`, `PROOFPILOT_SMOKE_PASSWORD`, `PROOFPILOT_SMOKE_TIMEOUT_MS`, `PROOFPILOT_SMOKE_KEEP_CASE=1`, or `PROOFPILOT_SMOKE_SKIP_DOWNLOAD=1` when needed.

CI runs this smoke check against compiled API and worker services with an isolated private MinIO bucket. A release candidate should not pass when packet queueing, worker execution, object storage, PDF rendering, or signed downloads are broken.
