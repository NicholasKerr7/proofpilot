# Architecture

ProofPilot is a pnpm/Turborepo monorepo with three runtime apps.

## Apps

- `apps/web`: Next.js App Router frontend.
- `apps/api`: NestJS REST API with Swagger documentation.
- `apps/worker`: BullMQ worker for document processing, packet generation, packet-share invitation delivery, reminder delivery, notification email delivery, and staging-upload cleanup.

## Packages

- `packages/types`: Shared case, assistant, auth, Inbox, settings, security, connection, billing, proof-map, submission, packet-sharing, and API schemas.
- `packages/database`: Prisma schema, client export, shared checklist analysis, and seed data.
- `packages/storage`: S3-compatible private evidence storage helpers.

## Local Services

- PostgreSQL stores users, cases, tasks, support requests and messages, assistant threads and messages, audit logs, connection metadata, billing metadata, evidence metadata, timelines, checklist data, statements, submission rounds and updates, packet exports, packet shares, notifications, and jobs.
- Redis backs document processing, notification email delivery, packet-share invitation delivery, packet generation, reminder delivery, and upload cleanup BullMQ queues.
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
- Unauthenticated API traffic is rate-limited by client address. Traffic with a signature-verified JWT uses a SHA-256 digest of its session ID as the in-memory bucket key so users behind the web proxy do not share one global limit; invalid bearer values remain in the IP bucket and raw tokens are never retained in limiter state.
- Storage helpers generate signed upload/download URLs instead of exposing private object URLs.
- The API streams completed uploads from private staging storage to ClamAV, then conditionally promotes the exact scanned ETag to a non-uploadable processing key before queueing work.
- Upload completion and the hourly cleanup worker atomically claim staging reservations before touching storage. Reservations inactive for 24 hours are marked expired, deleted from private storage, and removed from PostgreSQL; transient storage failures retain sanitized audit state for a later retry.
- Assistant threads use a compound user-and-case key, and every assistant request resolves authenticated read access before thread access.
- Assistant audit events record IDs, response mode, intent, and prompt length without duplicating message content in audit metadata.
- Collaboration management resolves every case through the authenticated owner ID. Audit metadata records collaborator IDs, roles, and changed setting names without storing invited email addresses.
- Packet-share creation and revocation resolve the ready export through the authenticated case owner. Audit metadata stores share IDs, recipient counts, permissions, and expiry without storing raw tokens or recipient addresses.
- Statement guidance, version restore, and summary generation resolve authenticated edit access to the active case. Audit metadata stores record IDs, answer counts, and source counts without duplicating answers, drafts, or summary text.
- Proof Map reads resolve authenticated case access and derive their response from already-owned evidence, checklist, timeline, and statement records.
- Submission reads require case read access; round creation and append-only updates require Editor or Owner access. Audit metadata excludes free-form submission notes and response details.
- Task reads resolve authenticated case access, while task mutations require Editor or Owner access. Task audit metadata records identifiers, priority, status, and progress without duplicating user-authored task content.
- Inbox list, detail, and read-state operations scope both support requests and notifications to the authenticated user. Invalid or foreign source-and-ID pairs return `404` without revealing record existence.

Extracted document text is source evidence rather than user-authored application metadata, so processing preserves it for review and search. It is still rendered only through escaped text contexts and normalized before PDF drawing; it is never inserted as executable HTML.

## Inbox Projection

Inbox conversations are projected from two existing owner-scoped stores instead of duplicating message data. `SupportRequest` and `SupportRequestMessage` provide replyable support threads, while eligible `Notification` rows provide read-only team, case-update, and system conversations. Support receipt notifications are excluded from the projection to prevent duplicate rows, and notification conversations tied only to archived cases are hidden.

`SupportRequest.readAt` and `Notification.readAt` retain source-specific state. The Inbox API validates the source enum before every lookup, includes the authenticated user ID in each query, and applies mark-all changes to both sources in one transaction. The standalone Notifications center remains available for the complete alert stream and uses the same notification read state.

## Notification Delivery

The worker registers idempotent BullMQ schedulers for `reminder-delivery` and `notification-email`. Reminder runs claim due, incomplete reminders with an atomic `sentAt IS NULL` update before creating notification delivery records, which prevents duplicate alerts across worker instances. Archived cases are excluded. The notifications API only reads in-app-visible records and does not trigger delivery as a side effect.

Reminder, case-status, evidence-processing, and packet-result producers independently honor the owner's in-app and email preferences. A `Notification` row acts as the durable email outbox, while `inAppVisible` keeps email-only records out of the Notifications center and Inbox projection. Before sending, the worker atomically leases each row and rechecks the current global email preference, category preference, and case archive state. Resend calls use the notification ID as an idempotency key; failures retain only a sanitized error code and retry with bounded backoff for up to five attempts. A suppressed reminder is still claimed and audited so re-enabling a preference does not unexpectedly replay an old prompt.

## Packet Sharing Foundation

Packet share URLs place a 256-bit random bearer token in the URL fragment. Browsers do not send fragments in the initial HTTP request, and the database stores only the token's SHA-256 hash. Public API calls send the raw token in JSON request bodies so it does not enter route parameters or ordinary URL logs.

Before packet details are returned, the recipient must submit an address on the share's normalized allowlist. When the owner enables verification, the API stores a hash-only six-digit challenge with a ten-minute expiry and five-attempt limit, then consumes it once before issuing a short-lived JWT scoped to that share and recipient. Every content and comment request validates both the link token and scoped JWT, and revoked or expired shares fail before a new signed object URL is created. Owners can revoke active shares from the sharing workspace.

`VIEW`, `COMMENT`, and `DOWNLOAD` permissions control whether the API returns an attachment URL and accepts comments. An inline signed PDF response is an authorization boundary, not DRM: a recipient who can view document bytes may still capture them. The UI does not claim stronger prevention. Share creation writes one invitation outbox row per recipient and returns without waiting for the provider. The worker leases rows, suppresses revoked or expired shares, signs a recipient-specific fragment token with the shared server secret, and retries failures with bounded backoff. Resend calls use the delivery ID for idempotency. Development simulation logs only internal IDs; addresses, packet content, codes, and link tokens are excluded. Document watermarking remains disabled until a processor is configured.

## Collaboration Foundation

Case owners can maintain a ten-seat roster, create expiring invitations, assign Editor or Viewer roles, remove collaborators, and persist sharing controls. The API derives expired invitation state at read time and excludes expired invitations from seat usage.

Invitation links contain 256-bit random bearer tokens, while PostgreSQL stores only SHA-256 hashes. Acceptance and decline require a signed-in account with the invited email address and consume the token atomically. Delivery failures invalidate the token and expire the pending roster entry.

An active Viewer has read-only access to the case, documents, checklist, timeline, statement, reminders, packets, and guided assistant context. An active Editor also has mutation access. Ownership remains required for archiving, collaboration management, and packet-share management. Audit entries attribute shared edits to the acting collaborator while storage keys, queue jobs, status notifications, and case records remain owned by the case owner. The prevent-download setting withholds signed document and packet URLs from Viewers; it is an authorization control, not DRM.

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

## Proof Map

The Proof Map is a read-only case projection rather than a second evidence store. Each checklist requirement becomes an appeal claim, and the API links it to exact matched document passages, document-backed timeline events, and relevant statement guidance. Strength reflects review state and source diversity; a missing source remains an explicit gap. The projection never changes checklist state and does not claim that an absent record disproves the user's account.

## Submission And Outcome Tracking

`CaseSubmission` preserves one record per appeal round, including channel, destination, confirmation code, response deadline, and current status. `SubmissionUpdate` is an append-only chronology of acknowledgements, information requests, follow-ups, status changes, notes, and decisions. Creating a round and assigning its next number occurs in one transaction. Terminal decisions record `resolvedAt`, while approved, denied, and action-required outcomes move the parent case into the appropriate workflow state. Future response deadlines create ordinary case reminders rather than a separate scheduler.

Portfolio workspaces clone immutable sample evidence entities, processing logs, checklist matches, timeline source links, submission rounds, and submission updates with remapped IDs. Reset expires and detaches only the current visitor's isolated graph, immediately provisions a fresh copy from the unchanged seed template, and lets the cleanup worker remove visitor-created storage before deleting the old records. Immutable `demo-samples/` keys are excluded from cleanup.
