# API Map

## Health

- `GET /health`
- `GET /health/ready`
- `GET /health/queues`

`GET /health` is a dependency-free process liveness check. `GET /health/ready` returns `200` only when PostgreSQL responds and all BullMQ queue connections can be read within the readiness timeout; it returns a sanitized `503` response otherwise. Retained failed jobs do not remove the API from service and remain visible through `GET /health/queues`.

All database-backed route parameters and resource-ID fields in request bodies or queries must be 1 to 128 characters and contain only letters, numbers, underscores, or hyphens. Malformed identifiers return `400` before a database or storage lookup; well-formed identifiers still pass through the endpoint's authenticated ownership checks.

User-authored names, case fields, timeline text, statements, guidance, reminder messages, packet comments, support messages, search text, and uploaded filenames are treated as plain text. The API removes markup and unsafe invisible characters before validating the sanitized value. Passwords, tokens, email addresses, IDs, enums, MIME types, and dates are validated by their dedicated rules and are not passed through the content sanitizer.

Authenticated cross-user lookups return `404` rather than confirming that another user's resource exists. `pnpm test:integration` exercises guarded controllers and a two-user read/write denial matrix against PostgreSQL, then verifies the foreign records were not changed.

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/request-password-reset`
- `POST /auth/reset-password`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/change-password`
- `POST /auth/logout`

## Case Types

- `GET /case-types`

## Cases

- `POST /cases`
- `GET /cases`
- `GET /cases/:id`
- `GET /cases/:id/activity`
- `PATCH /cases/:id`
- `DELETE /cases/:id`
- `POST /cases/:caseId/documents`
- `GET /cases/:caseId/documents`
- `GET /cases/:caseId/checklist`
- `POST /cases/:caseId/checklist/analyze`
- `PATCH /cases/:caseId/checklist/:itemId`
- `GET /cases/:caseId/timeline`
- `POST /cases/:caseId/timeline`
- `POST /cases/:caseId/timeline/analyze`
- `PUT /cases/:caseId/timeline/order`
- `PATCH /cases/:caseId/timeline/:eventId`
- `DELETE /cases/:caseId/timeline/:eventId`
- `GET /cases/:caseId/statement`
- `PUT /cases/:caseId/statement`
- `PUT /cases/:caseId/statement/guidance`
- `POST /cases/:caseId/statement/generate`
- `POST /cases/:caseId/statement/versions/:versionId/restore`
- `POST /cases/:caseId/summary/generate`
- `GET /cases/:caseId/packets`
- `POST /cases/:caseId/packet/generate`

Statement routes resolve the active case through authenticated case access. Editors and Owners can mutate statement data; Viewers can read it. Guided answers are stored separately from statement versions, draft generation uses only saved case context, and restoration creates a new current version instead of overwriting history. Summary generation versions the result in `CaseSummary` and updates the case's current summary for packet export.

## Case Collaboration

- `GET /cases/:caseId/collaboration`
- `POST /cases/:caseId/collaboration/invitations`
- `PATCH /cases/:caseId/collaboration/collaborators/:collaboratorId`
- `DELETE /cases/:caseId/collaboration/collaborators/:collaboratorId`
- `PATCH /cases/:caseId/collaboration/settings`
- `GET /collaboration/invitations/:token`
- `POST /collaboration/invitations/:token/accept`
- `POST /collaboration/invitations/:token/decline`

Case roster and settings endpoints require an authenticated Owner. Invitation previews are public bearer-token lookups; acceptance and decline require an authenticated account whose normalized email matches the invited address. Invitation tokens are single-use and expire. An accepted Viewer can read the case and its resources, while an accepted Editor can also mutate case work. Only the Owner can archive the case, manage collaborators, or manage packet shares. A Viewer receives document and packet download URLs only when the Owner has not enabled download prevention.

## Packet Sharing

Owner routes:

- `GET /cases/:caseId/packet-shares/prepare`
- `POST /cases/:caseId/packet-shares`
- `DELETE /cases/:caseId/packet-shares/:shareId`

Public recipient routes:

- `POST /packet-shares/metadata`
- `POST /packet-shares/access`
- `POST /packet-shares/content`
- `POST /packet-shares/comments`

Owner routes require an authenticated case-owner match and a ready packet export. Public routes accept the raw share token in a request body, never a URL path; content and comment calls also require a short-lived recipient access token. Email delivery, email verification, and PDF watermarking report as unavailable until providers are configured.

## Documents

- `GET /documents/:documentId`
- `DELETE /documents/:documentId`
- `POST /documents/:documentId/complete`
- `GET /documents/:documentId/processing-status`
- `POST /documents/:documentId/reprocess`

Upload completion validates the private staging object and performs a ClamAV stream scan before queueing work when scanning is enabled. The exact scanned ETag is conditionally promoted to a processing-only key. Production configuration requires scanning; infected objects are quarantined with storage deletion attempted, while scanner or promotion failures fail closed without queueing document processing.

Processed and deleted documents automatically refresh checklist matches. Users can explicitly complete or reopen owned checklist items; manual completions remain stable when evidence is re-analyzed.

## Notifications and Reminders

- `GET /notifications`
- `PATCH /notifications/:notificationId/read`
- `GET /reminders`
- `GET /cases/:caseId/reminders`
- `POST /cases/:caseId/reminders`
- `PATCH /reminders/:reminderId`
- `DELETE /reminders/:reminderId`

`GET /notifications` is read-only. The worker claims due reminders through the scheduled `reminder-delivery` queue and creates alerts independently of notification-inbox traffic. New deadline, case-update, evidence-processing, and packet-result alerts honor the owner's current in-app notification preferences.

## Assistant

- `GET /assistant/cases/:caseId`
- `POST /assistant/cases/:caseId/messages`

Both endpoints require an authenticated owner match before reading or writing a thread. The current capability is `GUIDED`: responses are derived deterministically from saved case, evidence, checklist, timeline, and statement records. No external model provider is configured.

## Settings

- `GET /settings`
- `PATCH /settings`

Settings include persisted analytics-usage and marketing-communication consent flags. Both default to disabled.

## Security

- `GET /security`
- `DELETE /security/sessions/:sessionId`
- `POST /security/sessions/revoke-others`

The security overview returns the authenticated user's password-change timestamp and up to ten active owner-scoped sessions. Session revocation uses an owner-filtered update and does not allow the management endpoint to end the caller's current session. Two-factor and biometric enrollment remain unavailable until real providers are configured.

## Connections

- `GET /connections`
- `POST /connections/:provider` (returns unavailable until that provider's OAuth flow is configured)
- `DELETE /connections/:provider`

Connection records are scoped to the authenticated user. The current demo seed stores presentation metadata only; it does not contain provider credentials or authorization tokens.

## Billing

- `GET /billing`
- `POST /billing/portal` (returns unavailable until a payment provider is configured)
- `GET /billing/invoices/:invoiceId/download`

Billing summaries and usage are scoped to the authenticated user. Invoice downloads resolve ownership through the user's subscription and return `404` for records outside that scope. Demo subscriptions store display metadata only, such as card brand, last four digits, and expiry; they do not store full card details or provider tokens.

## Reports

- `GET /reports/summary`
- `GET /reports/export`

Report summaries include open cases, uploaded evidence, missing required checklist items, future deadlines, generated packets, and failed document-processing totals. Packet totals count only `READY` or `DOWNLOADED` packets; generating and failed attempts are excluded. Every report query is limited to non-archived cases owned by the authenticated user.

## Support

- `GET /support/requests`
- `POST /support/requests`
- `GET /support/requests/:id`
- `POST /support/requests/:id/messages`
- `POST /support/article-feedback`

## Search

- `GET /search`

## Remaining Production Integrations

- Add provider-backed payments, OAuth connections, and model generation.
- Add two-factor and WebAuthn enrollment.
- Add packet email delivery, recipient email verification, and PDF watermarking.
