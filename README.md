# ProofPilot

ProofPilot turns messy evidence into professional appeal and dispute case packets. The MVP starts with an Account Ban / Appeal Builder.

## Stack

- pnpm + Turborepo
- Next.js App Router frontend in `apps/web`
- NestJS REST API in `apps/api`
- BullMQ worker in `apps/worker`
- Prisma + PostgreSQL in `packages/database`
- S3-compatible storage helpers in `packages/storage`

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

Local demo login after `pnpm db:seed`:

- Email: `nicholas.kerr@proofpilot.test`
- Password: `Password123!`

Run the authenticated packet flow smoke check after `pnpm dev` is running:

```bash
pnpm smoke:packet
```

## MVP Scope

The first product slice is Account Ban / Appeal Builder:

1. Register and log in.
2. Create a private case.
3. Upload evidence.
4. Process documents in the background.
5. Build a timeline and missing evidence checklist.
6. Draft a professional statement.
7. Generate a downloadable PDF packet.

This first commit establishes Sprint 0 infrastructure and starts Sprint 1 with auth and case APIs.
