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

Readiness checks PostgreSQL and the Redis connections behind all six BullMQ queues. It returns `200` with `status: ok` when both dependencies respond, or `503` with a sanitized `status: degraded` body when either dependency is unavailable or exceeds the three-second timeout. A readiness failure should remove the API replica from traffic without treating the process as dead.

If readiness is degraded, inspect `checks.database`, `checks.queues`, and the API `readiness_check_failed` structured log. Confirm `DATABASE_URL` and `REDIS_URL`, network policy, provider status, and credentials before restoring traffic. A retained failed queue job does not fail readiness; use the queue-health runbook below to diagnose job failures.

## Queue Health

Use the API queue health endpoint to check whether Redis-backed BullMQ queues are accepting and processing work:

```txt
GET /health/queues
```

The response contains one entry each for:

- `document-processing`
- `notification-email`
- `packet-generation`
- `reminder-delivery`
- `upload-cleanup`

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
6. Check the owner's in-app, email, and deadline-reminder preferences. Suppressed reminders are marked sent and audited without creating an alert.

## Notification Email Runbook

The worker registers `deliver-notification-emails-every-minute` on the `notification-email` queue. It atomically leases pending delivery rows, rechecks current preferences and case archive state, and retries provider failures for up to five attempts.

If notification email is delayed or exhausted:

1. Check `GET /health/queues` and confirm `notification-email` is not paused and has no growing failed count.
2. Confirm the worker logs `ProofPilot worker is listening on notification-email.`
3. Confirm `NOTIFICATION_EMAIL_DELIVERY_MODE=resend`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, and `WEB_ORIGIN` are set on the worker.
4. Confirm the sender identity is verified in Resend and inspect provider delivery events using `emailProviderId` from the notification record.
5. Check the owner's global email and category preference and whether the related case was archived. These conditions intentionally suppress a claimed delivery.
6. Inspect `notification.email_delivery_failed` audit entries for the sanitized error code and attempt count. Never add provider response bodies, addresses, or notification text to audit metadata.

A worker crash can leave a row in `SENDING`; it becomes eligible again after the ten-minute lease expires. The stable Resend idempotency key prevents that recovery path from creating a second provider send.

## Packet Share Email Runbook

Packet-share invitations use a PostgreSQL outbox and the `packet-share-email` worker queue. Share creation stores one pending row per recipient before returning a queued summary. The API triggers immediate processing, and a one-minute worker scheduler recovers missed triggers. Each row has a ten-minute lease and a stable delivery-specific Resend idempotency key.

If packet-share email is delayed or exhausted:

1. Check `GET /health/queues` and confirm `packet-share-email` is not paused and has no growing failed count.
2. Confirm the worker logs `ProofPilot worker is listening on packet-share-email.`
3. Confirm `JWT_SECRET`, `PACKET_SHARE_EMAIL_DELIVERY_MODE=resend`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, and `WEB_ORIGIN` are set on both API and worker where applicable.
4. Confirm the sender identity is verified in Resend and inspect provider delivery events using `providerMessageId` from `PacketShareEmailDelivery`.
5. Inspect `case.packet_share_email_delivery_failed` audit entries for the sanitized error code, attempt count, and retry time. Logs intentionally exclude addresses, content, access codes, link tokens, and provider response bodies.
6. Confirm the share is active. Revoked and expired shares intentionally produce `case.packet_share_email_suppressed` instead of a send.

Provider failures retry at 5 minutes, 15 minutes, 1 hour, and 6 hours. A worker crash leaves a row in `SENDING`; it becomes eligible after its ten-minute lease. Owners can still copy the manual share URL while delivery is pending or exhausted.

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

The worker registers `expire-abandoned-uploads-hourly` on the `upload-cleanup` queue. It claims staging reservations only after 24 hours without an update, then deletes the object and metadata. A failed object deletion leaves the document marked `FAILED`, records `upload_cleanup`, and becomes eligible for another attempt after 15 minutes.

If stale uploads accumulate, confirm `upload-cleanup` is not paused, verify the hourly scheduler exists, and inspect worker failures for `expire_abandoned_uploads`. Confirm worker storage credentials with `pnpm storage:bootstrap`. A provider lifecycle rule for the `upload-staging/` key segment remains recommended as a cleanup backstop for untracked objects and prolonged worker downtime.

## Rate Limit Runbook

API responses with `429 Too Many Requests` include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers. Use `x-request-id` from the response to find the matching structured request log entry.

If legitimate traffic is throttled, tune `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`. In multi-instance production deployments, use an edge or gateway limiter because the built-in limiter is process-local.

## Error Monitoring Runbook

For `500` API responses, capture `x-request-id` from the response and search API logs for the same request ID. The API logs sanitized error monitoring events for 500-level exceptions and can forward them to `ERROR_MONITORING_WEBHOOK_URL`.

Alert on repeated 500s for the same route, `GET /health/ready` returning `503`, repeated `ProofPilot worker job failed` events, and `GET /health/queues` returning `degraded`.
