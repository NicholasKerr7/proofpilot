# Operations

## API Probes

Use the dependency-free endpoint for liveness checks:

```txt
GET /health
```

Use the dependency-aware endpoint before routing traffic:

```txt
GET /health/ready
```

Readiness checks PostgreSQL and the Redis connections behind all three BullMQ queues. It returns `200` with `status: ok` when both dependencies respond, or `503` with a sanitized `status: degraded` body when either dependency is unavailable or exceeds the three-second timeout. A readiness failure should remove the API replica from traffic without treating the process as dead.

If readiness is degraded, inspect `checks.database`, `checks.queues`, and the API `readiness_check_failed` structured log. Confirm `DATABASE_URL` and `REDIS_URL`, network policy, provider status, and credentials before restoring traffic. A retained failed queue job does not fail readiness; use the queue-health runbook below to diagnose job failures.

## Queue Health

Use the API queue health endpoint to check whether Redis-backed BullMQ queues are accepting and processing work:

```txt
GET /health/queues
```

The response contains one entry each for:

- `document-processing`
- `packet-generation`
- `reminder-delivery`

Each queue reports BullMQ counts for `waiting`, `active`, `delayed`, `completed`, `failed`, `paused`, `prioritized`, and `waiting-children`. The aggregate status is `degraded` when any queue is paused, has retained failed jobs, or cannot be read from Redis.

## Packet Queue Runbook

If packet generation stays in `GENERATING`:

1. Check `GET /health/queues` and confirm `packet-generation` has no growing `waiting`, `delayed`, or `failed` count.
2. Confirm the worker service is running and logs `ProofPilot worker is listening on packet-generation.`
3. Confirm Redis is reachable from both API and worker with the same `REDIS_URL`.
4. Check worker logs for `ProofPilot worker job failed` entries.
5. Run `pnpm storage:bootstrap` to confirm S3 or MinIO credentials are valid and the configured bucket exists.
6. Run `pnpm smoke:packet` after the API and worker are restarted.

If document processing stalls, follow the same checks for `document-processing`, then inspect the document processing logs in the document detail API response.

## Reminder Queue Runbook

The worker registers `deliver-due-reminders-every-minute` as an idempotent BullMQ scheduler. If a due reminder remains unsent for more than two minutes:

1. Check `GET /health/queues` and confirm `reminder-delivery` is not paused and has no retained failures.
2. Confirm the worker logs `ProofPilot worker is listening on reminder-delivery.`
3. Confirm the API and worker use the same `REDIS_URL` and `DATABASE_URL` targets.
4. Inspect worker failures for the `deliver_due_reminders` job.
5. Confirm the reminder is incomplete, its case is not archived, and its `remindAt` timestamp is in the past.
6. Check the owner's in-app and deadline-reminder preferences. Suppressed reminders are marked sent and audited without creating an alert.

## Upload Security Runbook

If an uploaded document moves to `FAILED` before processing starts, check the document processing logs for `upload_validation`. The API rejects completed uploads when the stored object is missing, larger than 25 MB, has a different byte size than the reserved upload, or has a mismatched content type.

The next processing log step is `virus_scan`:

- `completed`: ClamAV found no known threat, the exact scanned ETag was promoted to an immutable processing key, and processing was queued.
- `failed` with a blocked-upload message: a threat was detected, the document was quarantined and marked `FAILED`, and stored-object deletion was attempted. Quarantine denies signed downloads and reprocessing even if storage cleanup needs an operator retry.
- `failed` with an unavailable message: the scanner or storage stream failed, nothing was queued, and the upload remains retryable.
- `skipped`: scanning is disabled in a non-production environment. Production startup rejects this configuration.

For an optional local scanner, allocate at least 3 GB RAM to Docker, then run:

```bash
docker compose --profile security up -d clamav
printf 'zPING\0' | nc 127.0.0.1 3310
```

Wait for `PONG`, set `VIRUS_SCAN_MODE=clamav`, and restart the API. The profile uses the official `clamav/clamav:1.4` feature tag so supported 1.4 LTS patches and signature updates are received without opting into a new feature release. It binds port 3310 to loopback only; do not expose the unauthenticated, unencrypted ClamAV TCP protocol publicly.

If scans report unavailable, inspect `docker compose logs clamav`, confirm `CLAMAV_HOST`, `CLAMAV_PORT`, and network policy, then retry the document completion call. An `UPLOAD_ETAG_CHANGED` audit error means the staging object changed between metadata validation and scanning; retry completion only after confirming the intended upload. The upload is intentionally not sent to BullMQ until a clean result is recorded and the scanned ETag is promoted.

Apply a 24-hour storage lifecycle expiration to the `upload-staging/` key segment. This is a cleanup backstop for abandoned upload reservations and for a signed URL reused after its original object was promoted.

## Rate Limit Runbook

API responses with `429 Too Many Requests` include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers. Use `x-request-id` from the response to find the matching structured request log entry.

If legitimate traffic is throttled, tune `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`. In multi-instance production deployments, use an edge or gateway limiter because the built-in limiter is process-local.

## Error Monitoring Runbook

For `500` API responses, capture `x-request-id` from the response and search API logs for the same request ID. The API logs sanitized error monitoring events for 500-level exceptions and can forward them to `ERROR_MONITORING_WEBHOOK_URL`.

Alert on repeated 500s for the same route, `GET /health/ready` returning `503`, repeated `ProofPilot worker job failed` events, and `GET /health/queues` returning `degraded`.
