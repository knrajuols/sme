

PROMPT 7 — IAM Service LLD implementation (LLD-01)

Implement iam-service per LLD-01.

Use Prisma (iam db). Create prisma schema with tables:
users, roles, permissions, role_permissions, user_roles, user_attributes, refresh_tokens, password_reset_tokens, login_audit.

Implement APIs:
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /users
GET /users
GET /users/:id
PATCH /users/:id
POST /users/:id/reset-password
POST /roles
GET /roles
PATCH /roles/:id
POST /roles/:id/permissions
DELETE /roles/:id/permissions/:permissionId
POST /users/:id/roles
DELETE /users/:id/roles/:roleId

Rules:
- password policy min 8, number, special
- lockout after 5 failures for 15 minutes
- refresh token stored hashed; rotate on refresh
- never log tokens/passwords
- emit AuditEventRequested events (via RMQ publisher) for login success/fail, user create/update/suspend, role changes

JWT:
- issue RS256 JWT access tokens with claims: sub, tenantId, roles, sessionId, exp
- For now store private/public keys in env (local only)

Add seeds:
- permissions seeded globally (permission_key unique)
- system roles for a tenant: SCHOOL_ADMIN, TEACHER, ACCOUNTS, HR, PRINCIPAL
- create initial PLATFORM_ADMIN user for platform (tenantId = "platform") OR separate flag - choose a clean approach and document.

Add Swagger docs.