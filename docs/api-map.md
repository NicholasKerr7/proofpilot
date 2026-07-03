# API Map

## Health

- `GET /health`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## Case Types

- `GET /case-types`

## Cases

- `POST /cases`
- `GET /cases`
- `GET /cases/:id`
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

## Next Sprints

- Worker queue observability and operational runbooks
