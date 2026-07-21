# ProofPilot

ProofPilot turns messy evidence into professional appeal and dispute case packets. The MVP starts with an Account Ban / Appeal Builder.

## Stack

- pnpm + Turborepo
- Next.js App Router frontend in `apps/web`
- NestJS REST API in `apps/api`
- BullMQ worker in `apps/worker`
- Prisma + PostgreSQL in `packages/database`
- S3-compatible storage helpers in `packages/storage`
- Optional ClamAV upload scanning through the `security` Compose profile

## Local Setup

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm storage:bootstrap
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

If you already initialized a local database with the older `pnpm db:push` flow, see the migration baseline note in [docs/deployment.md](docs/deployment.md).

Production deployment notes are in [docs/deployment.md](docs/deployment.md).

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API docs: `http://localhost:4000/docs`
- MinIO console: `http://localhost:9001`

`pnpm storage:bootstrap` loads `.env` and `.env.local`, then verifies or creates the configured private storage bucket. Run it after MinIO is up locally and before first API or worker traffic in production.

Local malware scanning is opt-in because ClamAV needs substantial memory. See [docs/operations.md](docs/operations.md#upload-security-runbook) before enabling `VIRUS_SCAN_MODE=clamav`.

Local demo login after `pnpm db:seed`:

- Email: `nicholas.kerr@proofpilot.test`
- Password: `Password123!`

Run the authenticated packet flow smoke check after `pnpm dev` is running:

```bash
pnpm smoke:packet
```

Run responsive and accessibility browser checks after PostgreSQL and Redis are running, the demo database is seeded, and `pnpm dev` is active:

```bash
pnpm --filter @proofpilot/web exec playwright install chromium
pnpm test:integration
pnpm test:e2e
```

The API integration suite starts an isolated Nest listener against the configured test database, creates a second authenticated user plus temporary foreign resources, verifies cross-user reads and mutations are denied, and removes its fixtures. The browser install is a one-time setup per Playwright version. The browser runner covers public authentication and the signed-in demo shell at mobile, tablet, and desktop viewports. CI provisions and starts its own isolated web/API stack.

## MVP Scope

The first product slice is Account Ban / Appeal Builder:

1. Register and log in.
2. Create a private case.
3. Upload evidence.
4. Process documents in the background.
5. Build a timeline and missing evidence checklist.
6. Get persisted, case-aware guidance without sending records to an external model provider.
7. Draft a professional statement.
8. Generate a downloadable PDF packet.

The local MVP now covers the owned case flow from authentication and evidence processing through checklist, timeline, statement, packet export, reminders, and in-app notifications. Production-only provider integrations and hardening work remain documented in the [project docs](docs/).
