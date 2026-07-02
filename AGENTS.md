# ProofPilot Codex Instructions

Build ProofPilot as a mobile-first, backend-heavy case packet application. Keep the MVP focused on Account Ban / Appeal Builder until the first complete case packet flow works.

## Engineering Standards

- Use pnpm, Turborepo, TypeScript, Next.js App Router, NestJS, Prisma, Redis/BullMQ, and S3-compatible storage.
- Keep all user-owned API resources protected by explicit ownership checks.
- Validate inputs at service boundaries.
- Prefer small typed modules over large multipurpose files.
- Use shared enums and schemas from `@proofpilot/types` when possible.
- Do not place database, Redis, storage, or SDK clients at module scope in the Next app.
- Do not expose secrets through frontend code.

## UI Standards

- Build mobile layout first, then tablet and desktop enhancements.
- Use dark graphite surfaces with restrained copper and champagne accents.
- Keep touch targets large and primary actions visible without hover.
- Preserve reduced-motion behavior.
- Use shadcn-style primitives and Lucide icons for controls.
- Do not use inline styles.

## Verification

- Run `pnpm lint`, `pnpm typecheck`, and relevant builds after changes.
- Review the final diff before finishing.
- Commit changes with a descriptive message when the task is complete.
