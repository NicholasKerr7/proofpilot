# Operations

## Queue Health

Use the API queue health endpoint to check whether Redis-backed BullMQ queues are accepting and processing work:

```txt
GET /health/queues
```

The response contains one entry each for:

- `document-processing`
- `packet-generation`

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

## Upload Validation Runbook

If an uploaded document moves to `FAILED` before processing starts, check the document processing logs for `upload_validation`. The API rejects completed uploads when the stored object is missing, larger than 25 MB, has a different byte size than the reserved upload, or has a mismatched content type.

`virus_scan_placeholder` with status `skipped` means the upload passed metadata validation, but no external scanning provider is configured yet.

## Rate Limit Runbook

API responses with `429 Too Many Requests` include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers. Use `x-request-id` from the response to find the matching structured request log entry.

If legitimate traffic is throttled, tune `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`. In multi-instance production deployments, use an edge or gateway limiter because the built-in limiter is process-local.

## Error Monitoring Runbook

For `500` API responses, capture `x-request-id` from the response and search API logs for the same request ID. The API logs sanitized error monitoring events for 500-level exceptions and can forward them to `ERROR_MONITORING_WEBHOOK_URL`.

Alert on repeated 500s for the same route, repeated `ProofPilot worker job failed` events, and `GET /health/queues` returning `degraded`.
