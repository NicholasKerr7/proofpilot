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

## Next Sprints

- `POST /cases/:caseId/documents`
- `GET /cases/:caseId/documents`
- `GET /documents/:documentId`
- `POST /documents/:documentId/reprocess`
