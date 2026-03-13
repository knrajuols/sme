
PROMPT 4 — Auth library (JWT + RBAC guard foundation)
Implement libs/auth:

- JwtService wrapper that validates JWT (RS256) and returns claims.
- AuthGuard that:
  - extracts Bearer token
  - validates token
  - populates RequestContext on request
  - denies if invalid/expired

- Roles decorator: @Roles("SCHOOL_ADMIN", "TEACHER", etc.)
- RolesGuard that checks user roles claim.
- Permission decorator and PermissionGuard placeholder (service-level check to be implemented later).

Include:
- token claim interface with tenantId, sub(userId), roles[], sessionId, exp
- ability to ignore X-Tenant-Id header for tenant users: always use claim tenantId
- platform admin support: allow X-Tenant-Id only if role contains PLATFORM_ADMIN

Add docs and examples in README snippets.

Do not implement IAM business logic yet.