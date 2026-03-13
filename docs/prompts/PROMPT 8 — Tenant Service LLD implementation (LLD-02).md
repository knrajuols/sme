
PROMPT 8 — Tenant Service LLD implementation (LLD-02)

Implement tenant-service per LLD-02.

Prisma schema: tenants, tenant_admins, tenant_domains, tenant_branches.

APIs:
POST /platform/tenants (create tenant + create primary admin via IAM REST call)
POST /platform/tenants/:id/activate
POST /platform/tenants/:id/suspend
PATCH /platform/tenants/:id
GET /platform/tenants
GET /tenant/me
PATCH /tenant/branding
POST /tenant/branches
PATCH /tenant/branches/:branchId
GET /tenant/branches

Emit events: TenantCreated, TenantStatusChanged, TenantUpdated and AuditEventRequested.

Implement tenant status caching endpoint for gateway:
GET /internal/tenants/:tenantId/status (secured by internal secret header)

Health endpoints.
Swagger docs.