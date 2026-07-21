# Architecture

ProofPilot is a pnpm/Turborepo monorepo with three runtime apps.

## Apps

- `apps/web`: Next.js App Router frontend.
- `apps/api`: NestJS REST API with Swagger documentation.
- `apps/worker`: BullMQ worker for document processing, packet generation, and scheduled reminder delivery.

## Packages

- `packages/types`: Shared case, assistant, auth, settings, security, connection, billing, packet-sharing, and API schemas.
- `packages/database`: Prisma schema, client export, shared checklist analysis, and seed data.
- `packages/storage`: S3-compatible private evidence storage helpers.

## Local Services

- PostgreSQL stores users, cases, assistant threads and messages, audit logs, connection metadata, billing metadata, evidence metadata, timelines, checklist data, statements, packet exports, packet shares, notifications, and jobs.
- Redis backs document processing, packet generation, and reminder delivery BullMQ queues.
- MinIO provides a local S3-compatible private storage target.
- ClamAV can scan private uploads through an opt-in local security profile or a private production service.

## Security Baseline

- API routes that read or mutate user-owned resources must check `ownerId`.
- A real HTTP/database integration suite creates an independent authenticated principal and temporary foreign case graph, expects `401` without authentication and `404` across cross-user reads and writes, then compares selected protected fields and record counts at the Prisma boundary before cleanup.
- Connected-account reads and revocations use the authenticated user's compound ownership key.
- Demo connection records never store OAuth credentials or third-party authorization tokens.
- Billing usage queries are filtered through the authenticated user's cases, documents, and packet exports.
- Invoice downloads resolve ownership through the authenticated user's billing subscription.
- Demo billing records keep display-only card metadata: brand, last four digits, and expiry. Full card numbers, security codes, and provider payment tokens are not stored.
- All request DTOs are validated with Nest validation pipes.
- Database-backed route, query, body, and array identifiers share one bounded resource-ID rule before ownership-aware service lookups.
- Persisted user-authored plain text is normalized at the DTO boundary. Markup, unsafe element content, control characters, and bidirectional override characters are removed before length validation and persistence.
- The web app renders stored content through escaped React text nodes and lint rejects raw HTML rendering. CSV exports separately neutralize spreadsheet formulas, and packet generation applies PDF-safe text normalization.
- Passwords are hashed with bcryptjs.
- API auth uses signed JWT bearer tokens linked to persisted, owner-scoped `AuthSession` records. Revoked or expired sessions fail even while the JWT signature remains valid.
- Password changes update a dedicated `passwordChangedAt` timestamp and revoke every other session. Password reset completion revokes all sessions.
- Password reset links carry 256-bit random tokens; PostgreSQL stores only SHA-256 hashes with expiry and one-time-use state.
- Successful registration and login events store sanitized client context in owner-linked audit logs. User-agent and IP metadata are display context only and never authorization inputs.
- Storage helpers generate signed upload/download URLs instead of exposing private object URLs.
- The API streams completed uploads from private staging storage to ClamAV, then conditionally promotes the exact scanned ETag to a non-uploadable processing key before queueing work.
- Assistant threads use a compound user-and-case key, and every assistant request resolves the case through the authenticated owner's ID before thread access.
- Assistant audit events record IDs, response mode, intent, and prompt length without duplicating message content in audit metadata.
- Collaboration management resolves every case through the authenticated owner ID. Audit metadata records collaborator IDs, roles, and changed setting names without storing invited email addresses.
- Packet-share creation and revocation resolve the ready export through the authenticated case owner. Audit metadata stores share IDs, recipient counts, permissions, and expiry without storing raw tokens or recipient addresses.
- Statement guidance, version restore, and summary generation resolve the active case through the authenticated owner. Audit metadata stores record IDs, answer counts, and source counts without duplicating answers, drafts, or summary text.

Extracted document text is source evidence rather than user-authored application metadata, so processing preserves it for review and search. It is still rendered only through escaped text contexts and normalized before PDF drawing; it is never inserted as executable HTML.

## Notification Delivery

The worker registers one idempotent BullMQ scheduler for `reminder-delivery`. Each run claims due, incomplete reminders with an atomic `sentAt IS NULL` update before creating an in-app notification, which prevents duplicate alerts across worker instances. Archived cases are excluded. The notifications API only reads notification records and does not trigger delivery as a side effect.

Reminder, case-status, evidence-processing, and packet-result producers read the owner's current in-app category preferences before creating an alert. A suppressed reminder is still claimed and audited so re-enabling a preference does not unexpectedly replay an old prompt.

## Packet Sharing Foundation

Packet share URLs place a 256-bit random bearer token in the URL fragment. Browsers do not send fragments in the initial HTTP request, and the database stores only the token's SHA-256 hash. Public API calls send the raw token in JSON request bodies so it does not enter route parameters or ordinary URL logs.

Before packet details are returned, the recipient must submit an address on the share's normalized allowlist. The API then issues a short-lived JWT scoped to that share and recipient. Every content and comment request validates both the raw link token and the scoped JWT, and revoked or expired shares fail before a new signed object URL is created. Owners can revoke active shares from the sharing workspace.

`VIEW`, `COMMENT`, and `DOWNLOAD` permissions control whether the API returns an attachment URL and accepts comments. An inline signed PDF response is an authorization boundary, not DRM: a recipient who can view document bytes may still capture them. The UI does not claim stronger prevention. Email delivery, one-time email verification, and document watermarking remain disabled until production providers are configured.

## Collaboration Foundation

Case owners can maintain a ten-seat roster, create expiring invitations, assign Editor or Viewer roles, remove collaborators, and persist sharing controls. The API derives expired invitation state at read time and excludes expired invitations from seat usage.

The current MVP intentionally keeps all case, document, packet, and assistant resources owner-only. A collaboration record does not grant resource access until invitation acceptance, collaborator-session authorization, and permission enforcement are implemented end to end. The prevent-download setting is persisted for that future enforcement boundary and is not presented as active protection for owner downloads.

## Security And Privacy Foundation

The Security & Privacy workspace reads password history and active sessions through `GET /security`. Session reads and revocations are restricted by the authenticated user ID, and the current session cannot be ended through the management endpoint. Privacy consent flags are persisted through the existing settings boundary.

The MVP intentionally reports two-factor enrollment and WebAuthn biometric enrollment as unavailable. It does not geolocate IP addresses or claim team visibility and automatic-retention behavior that has not been implemented.

## Billing Foundation

The MVP includes a persisted demo subscription and invoice history for the Nicholas Kerr workspace. Usage figures are calculated from owned application records rather than seeded presentation values. Invoice PDFs are generated by the API from an owner-scoped invoice record and label demo receipts so they cannot be mistaken for processed payments.

The billing portal endpoint validates the requested action but returns `503` until a payment provider is configured. A production provider integration must create hosted management sessions server-side and return only HTTPS destinations to the web app.

## Guided Assistant Foundation

The assistant workspace persists one owner-scoped thread per user and case. Its current guided responder classifies a request and composes case-aware next steps from records already stored in ProofPilot. It does not mutate case data, rewrite statements automatically, or claim model generation.

The schema reserves response-mode, model, token, and estimated-cost fields for a later model-backed capability. Those fields remain empty for guided responses, and the API reports `modelGeneration: false` so the web app can disclose the active capability accurately.

## Statement And Summary Workflow

The statement workspace persists seven validated guidance answers in a one-to-one `StatementGuidance` record. Deterministic draft generation combines those answers with the owned case, timeline, checklist, and evidence metadata; it does not send case content to an external model provider. Every save, generation, or restore operation creates a new immutable `StatementVersion`, and restoring an older entry never removes later history.

Case summary generation reads the same owned timeline and evidence boundary, creates a versioned `CaseSummary`, and updates `Case.summary` as the current packet-facing value in one transaction. The responsive editor presents guided steps on mobile and persistent question navigation, editor context, summary review, and recovery controls at wider breakpoints.
