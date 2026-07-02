# Architecture

ProofPilot is a pnpm/Turborepo monorepo with three runtime apps.

## Apps

- `apps/web`: Next.js App Router frontend.
- `apps/api`: NestJS REST API with Swagger documentation.
- `apps/worker`: BullMQ worker for document processing and packet generation jobs.

## Packages

- `packages/types`: Shared case, auth, and API schemas.
- `packages/database`: Prisma schema, client export, and seed data.
- `packages/storage`: S3-compatible private evidence storage helpers.

## Local Services

- PostgreSQL stores users, cases, audit logs, evidence metadata, timelines, checklist data, statements, packet exports, notifications, and jobs.
- Redis backs BullMQ queues.
- MinIO provides a local S3-compatible private storage target.

## Security Baseline

- API routes that read or mutate user-owned resources must check `ownerId`.
- All request DTOs are validated with Nest validation pipes.
- Passwords are hashed with bcryptjs.
- API auth uses JWT bearer tokens for the MVP foundation.
- Storage helpers generate signed upload/download URLs instead of exposing private object URLs.
