# Authentication & Roles

## Authentication Flow

1. User submits email/password to `/auth/login`
2. Backend validates credentials against Users table
3. Issues JWT with:
   - `sub` (user ID)
   - `email`
   - `role` (`EMPLOYEE`/`AGENT`/`ADMIN`)
   - `exp` (expiration)
4. Client stores token and sends in `Authorization: Bearer <token>`
5. Refresh token is stored as an HTTP-only cookie and used to obtain new access tokens

## Roles & Permissions

| Resource | EMPLOYEE | AGENT | ADMIN |
|----------|----------|-------|-------|
| View own tickets | ✅ | ✅ | ✅ |
| Create ticket | ✅ | ❌ | ❌ |
| View KB articles | ✅ | ✅ | ✅ |
| View all tickets (any user) | ❌ | ✅ | ✅ |
| Update ticket status/assignee | ❌ | ✅ | ✅ |
| Manage users/teams | ❌ | ✅ | ✅ |

## Middleware

- `auth.middleware.ts` – validates JWT, attaches `req.user`
- `role.middleware.ts` – checks required role for route

## Security Best Practices

- Use HTTPS in production
- Rotate JWT secrets regularly
- Enforce password policies
- Log all auth attempts
- Rate limit login endpoint
- Invalidate tokens on password change
