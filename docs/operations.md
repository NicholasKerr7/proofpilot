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
