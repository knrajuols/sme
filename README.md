# SME – School Management Excellence

Production-ready NestJS microservices monorepo using npm workspaces, Prisma, PostgreSQL, Redis, RabbitMQ, Swagger, and pino logging.

## Tech Stack

- NestJS (TypeScript)
- Prisma ORM
- PostgreSQL (native at `localhost:5432`)
- Redis (`localhost:6379`)
- RabbitMQ (`localhost:5672`)
- npm workspaces
- Swagger (`/docs` per service)
- pino logger (`nestjs-pino`)

## Monorepo Structure

```text
apps/
  api-gateway/
  iam-service/
  tenant-service/
  config-service/
  audit-service/
libs/
  common/
  auth/
  messaging/
  config-client/
  tenant-client/
  logger/
```

## Service Ports

- `api-gateway`: `3000`
- `iam-service`: `3001`
- `tenant-service`: `3002`
- `config-service`: `3003`
- `audit-service`: `3004`

## PostgreSQL Databases

Each service has an isolated Prisma schema and database URL:

- `iam-service` → `sme_iam`
- `tenant-service` → `sme_tenant`
- `config-service` → `sme_config`
- `audit-service` → `sme_audit`

No Docker Compose is used for PostgreSQL in this setup.

## Prerequisites

- Node.js 20+
- npm 10+
- Native PostgreSQL running on `localhost:5432`
- Redis running on `localhost:6379`
- RabbitMQ running on `localhost:5672`

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` files per service from examples:

   ```bash
   copy apps\api-gateway\.env.example apps\api-gateway\.env
   copy apps\iam-service\.env.example apps\iam-service\.env
   copy apps\tenant-service\.env.example apps\tenant-service\.env
   copy apps\config-service\.env.example apps\config-service\.env
   copy apps\audit-service\.env.example apps\audit-service\.env
   ```

3. Create PostgreSQL databases:

   ```sql
   CREATE DATABASE sme_iam;
   CREATE DATABASE sme_tenant;
   CREATE DATABASE sme_config;
   CREATE DATABASE sme_audit;
   ```

4. Generate Prisma clients:

   ```bash
   npm run prisma:generate
   ```

5. Run Prisma migrations per service (initial):

   ```bash
   npm run prisma:migrate:dev -w @sme/iam-service
   npm run prisma:migrate:dev -w @sme/tenant-service
   npm run prisma:migrate:dev -w @sme/config-service
   npm run prisma:migrate:dev -w @sme/audit-service
   ```

## Run Services (Development)

Use separate terminals:

```bash
npm run start:dev:api-gateway
npm run start:dev:iam
npm run start:dev:tenant
npm run start:dev:config
npm run start:dev:audit
```

Or run all services concurrently from the monorepo root:

```bash
npm run dev:all
```

Swagger docs:

- `http://localhost:3000/docs`
- `http://localhost:3001/docs`
- `http://localhost:3002/docs`
- `http://localhost:3003/docs`
- `http://localhost:3004/docs`

## Standards Included

- Global validation pipe (`whitelist`, `transform`, `forbidNonWhitelisted`) in each service
- Standard response envelope:

  ```json
  {
    "status": "success|fail",
    "message": "string",
    "data": {},
    "error": {
      "code": "string",
      "details": {}
    }
  }
  ```

- Global exception filter returning fail envelope
- Centralized pino logger module
- Shared messaging module configured for RabbitMQ

## Useful Commands

```bash
npm run lint
npm run format
npm run build
```

# 🔐 Multi-Tenant Security Architecture

This architecture enforces strict tenant isolation and role/permission authorization across gateway and service boundaries. The control model is deterministic: identity is established by JWT claims, tenant scope is resolved centrally, permission checks are mandatory on protected routes, and denied actions are auditable.

## 1) JWT Structure

Access tokens follow a standardized payload contract:

```json
{
  "sub": "string",
  "tenantId": "string",
  "roles": ["string"],
  "permissions": ["string"],
  "sessionId": "string",
  "iat": 1700000000,
  "exp": 1700003600
}
```

- `tenantId` is the authoritative tenant context for the request lifecycle.
- Client headers do not supersede JWT tenant context for non-platform users.
- Platform-scoped tokens use `tenantId: "platform"` with role `PLATFORM_ADMIN`.
- Downstream calls carry service-issued bearer tokens preserving resolved tenant scope.

## 2) Tenant Resolution Rules

Tenant scope resolution is centralized at the gateway and then propagated downstream.

| Principal Type | Can Override `X-Tenant-Id` | Effective Tenant Source | Audit Requirement |
| --- | --- | --- | --- |
| Tenant User (non-platform) | No | JWT `tenantId` claim | Override attempts are logged as denied impersonation |
| Platform Admin | Yes | `X-Tenant-Id` when provided, else JWT `tenantId` | All impersonation usage is logged |

Impersonation events are emitted as `AuditEventRequested` messages for both accepted and denied cases, including actor identity, requested tenant, and resolved tenant.

## 3) Permission Enforcement Model

Authorization is permission-based and enforced consistently through shared guard infrastructure.

- Endpoints declare required permissions via `@Permissions("PERMISSION_CODE")`.
- A global `PermissionGuard` evaluates required permissions against `user.permissions` claims.
- `PLATFORM_ADMIN` is treated as full-access by policy.
- Authorization failures return HTTP `403` using the standard response envelope with `code: "PERMISSION_DENIED"`.
- Permission denials are audit-logged via `AuditEventRequested` to preserve forensic traceability.

Canonical permission set:

- `TENANT_CREATE`
- `USER_CREATE`
- `ROLE_ASSIGN`
- `MODULE_ENABLE`
- `MODULE_DISABLE`
- `CONFIG_UPDATE`
- `AUDIT_VIEW`

Role mappings:

- `PLATFORM_ADMIN` → all permissions
- `SCHOOL_ADMIN` → `USER_CREATE`, `ROLE_ASSIGN`, `MODULE_ENABLE`, `MODULE_DISABLE`
- `TEACHER` → no permissions by default

## 4) Cross-Tenant Protection

Cross-tenant protection is enforced in layered controls to prevent bypass through any single tier.

- **JWT layer**: authenticated identity always includes `tenantId`; non-platform principals are tenant-bound.
- **Gateway resolution layer**: tenant context is derived from JWT and only platform admins may impersonate via `X-Tenant-Id`.
- **Service guard layer**: tenant scope guard blocks route-level cross-tenant access and returns `TENANT_SCOPE_VIOLATION`.
- **Database query layer**: tenant-bound reads/writes are scoped by tenant-aware predicates and service-level tenant context.

Automated regression verification is provided by `npm run security:validate`, which executes cross-tenant and impersonation assertions.

## 5) Internal Endpoint Protection

All `/internal/*` routes are protected as privileged service-to-service endpoints.

- Required header: `X-Internal-Secret`
- Required value source: `INTERNAL_SERVICE_SECRET` environment variable
- JWT authentication is still mandatory on internal routes
- No JWT bypass exists for internal paths

Requests missing `X-Internal-Secret`, using an incorrect secret, or lacking valid JWT are rejected.

## 6) security:validate Contract

`npm run security:validate` validates critical isolation and authorization guarantees.

Validation flow:

1. Create Tenant A
2. Create Tenant B
3. Authenticate as Tenant A admin
4. Attempt Tenant B access using Tenant A token (must return `403`)
5. Authenticate as platform admin
6. Perform tenant impersonation using `X-Tenant-Id` (must succeed)
7. Verify audit entries were created for security-relevant actions

PASS criteria:

- Cross-tenant access is blocked (`403`)
- Platform impersonation succeeds under policy
- Audit records are persisted for relevant events
- Script exits successfully and prints `security:validate PASS`
