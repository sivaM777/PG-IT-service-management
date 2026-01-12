# API Specification

## Base URL
`http://localhost:8000/api/v1`

## Authentication
- Bearer token (JWT) in `Authorization` header
- Roles: `EMPLOYEE`, `AGENT`, `ADMIN`

## Endpoints

### Auth
- `POST /auth/login` – email/password → JWT
- `POST /auth/refresh` – refresh token
- `GET /auth/me` – current user profile

### Tickets
- `POST /tickets` – create ticket (EMPLOYEE)
- `GET /tickets/my` – list own tickets (EMPLOYEE)
- `GET /tickets` – list all tickets (ADMIN/AGENT)
- `GET /tickets/{id}` – details + history + SLA view (EMPLOYEE own; ADMIN/AGENT any)
- `PATCH /tickets/{id}/status` – update status with transition enforcement (ADMIN/AGENT)
- `PATCH /tickets/{id}/assign` – assign team/agent (ADMIN/AGENT)

### Knowledge Base
- `GET /kb` – search + filter
- `GET /kb/{id}` – article

### Users/Teams (Admin)
- `GET /users` – list
- `GET /users/me` – current user profile
- `GET /teams` – list

### Notifications (internal)
- Ticket email notifications are sent on create/assign/status-change when SMTP is configured

## Events (Webhooks)
- `ticket.created`
- `ticket.assigned`
- `ticket.resolved`
- `ticket.sla_breach`

## Errors
- 400 Bad Request – validation
- 401 Unauthorized – missing/invalid token
- 403 Forbidden – insufficient role
- 404 Not Found
- 500 Internal Server Error
