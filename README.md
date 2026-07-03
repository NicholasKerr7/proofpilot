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
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API docs: `http://localhost:4000/docs`
- MinIO console: `http://localhost:9001`

Local demo login after `pnpm db:seed`:

- Email: `nicholas.kerr@proofpilot.test`
- Password: `Password123!`

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
