# API Map

## Health

- `GET /health`
- `GET /health/queues`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/change-password`

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
- `GET /cases/:caseId/timeline`
- `POST /cases/:caseId/timeline`
- `POST /cases/:caseId/timeline/analyze`
- `GET /cases/:caseId/statement`
- `PUT /cases/:caseId/statement`
- `POST /cases/:caseId/statement/generate`
- `GET /cases/:caseId/packets`
- `POST /cases/:caseId/packet/generate`

## Case Collaboration

- `GET /cases/:caseId/collaboration`
- `POST /cases/:caseId/collaboration/invitations`
- `PATCH /cases/:caseId/collaboration/collaborators/:collaboratorId`
- `DELETE /cases/:caseId/collaboration/collaborators/:collaboratorId`
- `PATCH /cases/:caseId/collaboration/settings`

These management endpoints require an authenticated case-owner match. Invitations and active demo roster records do not grant case or document access in the current MVP; invitation acceptance and collaborator-session authorization remain future work.

## Documents

- `GET /documents/:documentId`
- `DELETE /documents/:documentId`
- `POST /documents/:documentId/complete`
- `GET /documents/:documentId/processing-status`
- `POST /documents/:documentId/reprocess`

## Notifications and Reminders

- `GET /notifications`
- `PATCH /notifications/:notificationId/read`
- `GET /reminders`
- `GET /cases/:caseId/reminders`
- `POST /cases/:caseId/reminders`
- `PATCH /reminders/:reminderId`
- `DELETE /reminders/:reminderId`

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

The security overview returns the authenticated user's password-change timestamp and up to five owner-scoped successful authentication events. It also returns explicit capability flags; two-factor enrollment, biometric enrollment, and session revocation remain unavailable until real providers are configured.

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

## Support

- `GET /support/requests`
- `POST /support/requests`
- `GET /support/requests/:id`
- `POST /support/requests/:id/messages`
- `POST /support/article-feedback`

## Search

- `GET /search`

## Next Sprints

- Desktop visual reference integration when assets arrive
