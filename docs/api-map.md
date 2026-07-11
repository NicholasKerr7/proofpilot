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

## Documents

- `GET /documents/:documentId`
- `DELETE /documents/:documentId`
- `POST /documents/:documentId/complete`
- `GET /documents/:documentId/processing-status`
- `POST /documents/:documentId/reprocess`

## Notifications and Reminders

- `GET /notifications`
- `PATCH /notifications/:notificationId/read`
- `GET /cases/:caseId/reminders`
- `POST /cases/:caseId/reminders`
- `DELETE /reminders/:reminderId`

## Reports

- `GET /reports/summary`
- `GET /reports/export`

## Support

- `GET /support/requests`
- `POST /support/requests`
- `POST /support/article-feedback`

## Search

- `GET /search`

## Next Sprints

- Desktop visual reference integration when assets arrive
