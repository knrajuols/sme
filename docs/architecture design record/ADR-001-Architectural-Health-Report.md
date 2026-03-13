# SME – School Management Excellence
# Definitive Architectural Health Report
**Version:** 1.0 — 360-Degree Audit
**Date:** 2026-02-28
**Scope:** Core Foundation — Schema, Gateway, Inter-Service, DevOps
**Auditor Role:** Principal Systems Architect

---

## Executive Summary

This report audits the SME platform against its own BRD, SRS, HLD, and five LLD documents. The platform has a strong structural foundation — the tenant-service schema is the most mature, with relational models for exams, grading, and attendance. However, **seven critical risks** exist that will cause production failures in a multi-tenant environment if not resolved before any further feature work.

**Overall Readiness Rating: 6.2 / 10 — DO NOT SHIP until Must-Fix Log is resolved.**

---

## Table of Contents

1. [Must-Fix Risk Log](#1-must-fix-risk-log)
2. [Finalized Schema 2.0 — Relational-First](#2-finalized-schema-20---relational-first)
3. [Hardened API Blueprint](#3-hardened-api-blueprint)
4. [Inter-Service Reliability Design](#4-inter-service-reliability-design)
5. [Enterprise DevOps & Resilience](#5-enterprise-devops--resilience)
6. [Revisit List — Items Beyond Original Prompt Scope](#6-revisit-list)

---

## 1. Must-Fix Risk Log

> Severity: 🔴 CRITICAL (data loss / security breach) | 🟠 HIGH (multi-tenancy violation) | 🟡 MEDIUM (compliance/correctness gap) | 🔵 LOW (operational friction)

---

### RISK-01 — IAM: Email Uniqueness Breaks Multi-Tenancy
**Severity:** 🔴 CRITICAL
**Location:** `apps/iam-service/prisma/schema.prisma` → `User.email @unique`

**Problem:**
```prisma
model User {
  email String @unique   // ← GLOBAL unique — blocks same email across schools
}
```
A teacher at `SchoolA` with `teacher@gmail.com` prevents any other school from registering the same address. In enterprise SaaS, identity is **tenant-scoped**. This constraint will cause `P2002 Unique constraint failed` rejections for legitimate multi-tenant enrollments.

**Fix Required:**
```prisma
model User {
  email    String
  tenantId String
  @@unique([tenantId, email])
}
```

---

### RISK-02 — IAM: Role and UserRole Have No Tenant Scope
**Severity:** 🔴 CRITICAL
**Location:** IAM schema — `Role`, `UserRole`, `RolePermission`

**Problem:**
```prisma
model Role {
  code String @unique  // GLOBAL — a role named TEACHER at SchoolA blocks SchoolB from creating their own TEACHER role
}

model UserRole {
  userId String
  roleId String
  // NO tenantId — a user's roles are not isolated per tenant
}
```
A `PLATFORM_ADMIN` can see and potentially act on roles from another tenant. RBAC must be tenant-scoped end-to-end.

**Fix Required:**
```prisma
model Role {
  id          String  @id @default(uuid())
  tenantId    String
  code        String
  name        String
  isSystem    Boolean @default(false)
  softDelete  Boolean @default(false)
  version     Int     @default(1)
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
}

model UserRole {
  id        String   @id @default(uuid())
  tenantId  String
  userId    String
  roleId    String
  createdAt DateTime @default(now())
  createdBy String?

  @@unique([tenantId, userId, roleId])
  @@index([tenantId])
}

model RolePermission {
  id           String @id @default(uuid())
  tenantId     String
  roleId       String
  permissionId String
  createdAt    DateTime @default(now())

  @@unique([tenantId, roleId, permissionId])
  @@index([tenantId])
}
```

---

### RISK-03 — IAM: Missing Core Token & ABAC Tables
**Severity:** 🔴 CRITICAL
**Location:** IAM schema — LLD-01 specified these; they are absent

**Missing models (specified in LLD-01 §5.7, §5.8, §5.6):**

| LLD-01 Table | Status | Impact |
|---|---|---|
| `RefreshToken` | ❌ MISSING | Cannot implement secure token rotation / logout |
| `PasswordResetToken` | ❌ MISSING | Cannot implement forgot-password flow |
| `UserAttribute` | ❌ MISSING | ABAC (class/campus-scoped access) impossible |
| `LoginAudit` | ❌ MISSING | Account lockout state is stateless; fails across restarts |

**Fix Required:** Add all four models (schema defined in Section 2 below).

---

### RISK-04 — Audit Service: Compliance Gaps
**Severity:** 🔴 CRITICAL
**Location:** `apps/audit-service/prisma/schema.prisma`

**Problems identified:**

```prisma
model AuditEvent {
  tenantId String?  // ← NULLABLE on a compliance table is a critical gap
  // Missing: beforeSnapshot, afterSnapshot, sourceService, ipAddress, userAgent
  // Missing: moduleKey as a first-class indexed field
}
```

- `tenantId` nullable means audit records can be orphaned with no tenant context — legally indefensible
- No `beforeSnapshot`/`afterSnapshot` fields means you cannot answer "what changed?" for a compliance audit
- No `AuditRetentionPolicy` or `AuditExportJob` tables (specified in LLD-04 §3.2, §3.3)
- `eventType` and `entity` combo cannot replace an explicit indexed `moduleKey` for fast module-level compliance exports

**Fix Required:** See Section 2 — Schema 2.0.

---

### RISK-05 — Config Service: Non-Relational Design & tenantCode Key
**Severity:** 🟠 HIGH
**Location:** `apps/config-service/prisma/schema.prisma`

**Problems:**

```prisma
model Configuration {
  tenantCode String @unique  // ← Uses code, not UUID. Breaks joins and FK integrity.
  payload    Json            // ← Entire config as single monolith JSON blob
  version    Int @default(1) // ← versioned but no isActive flag, no rollback model
}

model ConfigMaster {
  // Missing: version, isActive, softDelete fields
  // Cannot roll back to a previous config version
}
```

1. `tenantCode` as key means tenant rename or code reissue breaks all config joins
2. Single `payload` blob means atomic updates to one key require read-modify-write of the entire blob — race condition risk under concurrent updates
3. `ConfigMaster` lacks `isActive` and a `version` field — LLD-03 §4.1 explicitly required versioning and rollback support

**Fix Required:** Split `Configuration` blob into keyed `ConfigMaster` rows (already partially done) and fix `Configuration` to use `tenantId UUID`.

---

### RISK-06 — Gateway: No Idempotency Key Enforcement
**Severity:** 🟠 HIGH
**Location:** `apps/api-gateway/src/` — no `IdempotencyMiddleware` or `IdempotencyGuard`

**Problem:**
Network retries on `POST /students`, `POST /fees/pay`, `POST /exam/marks` without idempotency protection will create duplicate records. The `x-idempotency-key` header is defined in HLD Appendix B but not enforced anywhere in the gateway or services.

**Fix Required:** See Section 3 — Hardened API Blueprint.

---

### RISK-07 — Gateway: No Rate Limiter & No Module Enforcement Middleware
**Severity:** 🟠 HIGH
**Location:** `apps/api-gateway/src/app.module.ts`

**Problems:**
- `@nestjs/throttler` is not present in the gateway module — no rate limiting despite LLD-05 §9
- No `ModuleEnforcementGuard` that checks `ModuleEntitlement` per route prefix — a suspended module can still be called directly
- `ThrottlerModule` is missing from dependencies

**Fix Required:** Add `ThrottlerModule.forRoot(...)` and `ModuleGuard` to gateway (Section 3).

---

### RISK-08 — Tenant Schema: Status as Unvalidated String
**Severity:** 🟡 MEDIUM
**Location:** `apps/tenant-service/prisma/schema.prisma` → `Tenant.status String`

**Problem:**
```prisma
model Tenant {
  status String @default("active")  // Free string — any value accepted
}
```
Nothing prevents `status = "banana"` in code. Lifecycle state machine (TRIAL → ACTIVE → SUSPENDED → TERMINATED) must be enforced at schema level via enum.

**Fix Required:**
```prisma
enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  TERMINATED
}

model Tenant {
  status TenantStatus @default(TRIAL)
}
```

---

### RISK-09 — Tenant Model: Missing version & Audit Fields
**Severity:** 🟡 MEDIUM
**Location:** `Tenant` model in tenant-service

**Problem:**
`Tenant` itself is missing `createdBy`, `updatedBy`, `softDelete`, and `version`. Every other entity in the same schema has these fields — the root entity does not. This makes tenant-level changes unauditable and prevents optimistic locking on concurrent admin updates.

---

### RISK-10 — Portal Service: Duplicate Denormalized Schema Without Integrity
**Severity:** 🟡 MEDIUM
**Location:** `apps/portal-service/prisma/schema.prisma`

**Problem:**
`portal-service` contains its own copies of `Student`, `AttendanceRecord`, `Exam` — denormalized read replicas with no FK integrity. The `AttendanceSession` model here is missing `classId`, `sectionId`, `academicYearId` that the canonical version (tenant-service) has. Read stale data could be served to parents as authoritative.

**Fix Required:** Establish clear "read projection vs. canonical source" convention. Portal-service projections must carry a `lastSyncedAt` timestamp and must not expose stale data older than a configurable TTL.

---

### Summary Table

| Risk ID | Severity | Service | Impact |
|---|---|---|---|
| RISK-01 | 🔴 CRITICAL | IAM | Multi-tenant email uniqueness broken |
| RISK-02 | 🔴 CRITICAL | IAM | RBAC not tenant-scoped → privilege leakage |
| RISK-03 | 🔴 CRITICAL | IAM | No refresh tokens, ABAC, lockout tables |
| RISK-04 | 🔴 CRITICAL | Audit | Nullable tenantId, no snapshots = compliance failure |
| RISK-05 | 🟠 HIGH | Config | tenantCode FK, monolith blob, no rollback |
| RISK-06 | 🟠 HIGH | Gateway | No idempotency → duplicate records |
| RISK-07 | 🟠 HIGH | Gateway | No rate limiter, no module enforcement |
| RISK-08 | 🟡 MEDIUM | Tenant | Status free string → lifecycle corruption |
| RISK-09 | 🟡 MEDIUM | Tenant | Tenant root missing audit/version fields |
| RISK-10 | 🟡 MEDIUM | Portal | Denormalized projections lack sync integrity |

---

## 2. Finalized Schema 2.0 — Relational-First

### 2.1 IAM Service — Schema 2.0

```prisma
// ============================================================
// IAM SERVICE — SCHEMA 2.0
// Key changes from v1:
//   • tenantId added to User, Role, UserRole, RolePermission
//   • email uniqueness scoped to (tenantId, email)
//   • Role.code uniqueness scoped to (tenantId, code)
//   • Added RefreshToken, PasswordResetToken, UserAttribute, LoginAudit
//   • Added softDelete, version, createdBy, updatedBy everywhere
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// Platform-level user record. tenantId is null for PLATFORM_ADMIN users.
model User {
  id                  String    @id @default(uuid())
  tenantId            String?   // null = platform admin

  email               String?
  username            String?
  displayName         String
  passwordHash        String
  status              UserStatus @default(ACTIVE)
  failedLoginCount    Int       @default(0)
  lastFailedLoginAt   DateTime?
  lockedUntil         DateTime?
  lastLoginAt         DateTime?
  mustChangePassword  Boolean   @default(false)

  // Standard audit fields
  softDelete  Boolean  @default(false)
  version     Int      @default(1)
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userRoles       UserRole[]
  userAttributes  UserAttribute[]
  refreshTokens   RefreshToken[]
  passwordResets  PasswordResetToken[]
  loginAudits     LoginAudit[]

  // Email unique per tenant (null tenantId = platform admin pool)
  @@unique([tenantId, email])
  @@unique([tenantId, username])
  @@index([tenantId])
  @@index([email])
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  LOCKED
  PENDING_RESET
}

/// Tenant-scoped role definitions. PLATFORM_ADMIN roles use tenantId = null.
model Role {
  id          String   @id @default(uuid())
  tenantId    String?  // null = platform-level system role
  code        String
  name        String
  description String?
  isSystem    Boolean  @default(false)
  softDelete  Boolean  @default(false)
  version     Int      @default(1)
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userRoles       UserRole[]
  rolePermissions RolePermission[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

/// Platform-defined permission catalog — seeded, not tenant-owned.
model Permission {
  id            String   @id @default(uuid())
  code          String   @unique  // Global unique — permissions are platform constants
  name          String
  moduleKey     String   // fees|attendance|exam|student|iam
  createdAt     DateTime @default(now())

  rolePermissions RolePermission[]
}

/// Tie a permission to a role, scoped per tenant.
model RolePermission {
  id           String   @id @default(uuid())
  tenantId     String?
  roleId       String
  permissionId String
  createdAt    DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([tenantId, roleId, permissionId])
  @@index([tenantId])
}

/// Assign a role to a user within a tenant context.
model UserRole {
  id        String   @id @default(uuid())
  tenantId  String?
  userId    String
  roleId    String
  createdAt DateTime @default(now())
  createdBy String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId, roleId])
  @@index([tenantId])
  @@index([userId])
}

/// ABAC key-value attributes on a user (e.g. campusId, departmentId).
model UserAttribute {
  id        String   @id @default(uuid())
  tenantId  String
  userId    String
  attrKey   String
  attrValue String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId, attrKey])
  @@index([tenantId])
  @@index([userId])
}

/// Secure refresh token store — only hash stored, never raw token.
model RefreshToken {
  id           String    @id @default(uuid())
  tenantId     String?
  userId       String
  sessionId    String
  tokenHash    String    @unique
  issuedAt     DateTime  @default(now())
  expiresAt    DateTime
  revokedAt    DateTime?
  revokedReason String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId])
  @@index([sessionId])
}

/// One-time password reset tokens — hash only, never raw.
model PasswordResetToken {
  id        String    @id @default(uuid())
  tenantId  String?
  userId    String
  tokenHash String    @unique
  issuedAt  DateTime  @default(now())
  expiresAt DateTime
  usedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId])
}

/// Lightweight per-request login audit for lockout state & forensics.
model LoginAudit {
  id              String   @id @default(uuid())
  tenantId        String?
  userId          String?
  loginIdentifier String
  success         Boolean
  ipAddress       String?
  userAgent       String?
  failReason      String?
  createdAt       DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([userId])
  @@index([createdAt])
}

/// Idempotency key store — prevents duplicate mutations on retry.
model IdempotencyKey {
  id            String   @id @default(uuid())
  tenantId      String
  keyHash       String
  requestPath   String
  responseStatus Int
  responseBody  Json
  createdAt     DateTime @default(now())
  expiresAt     DateTime

  @@unique([tenantId, keyHash])
  @@index([tenantId])
  @@index([expiresAt])
}

model ProcessedEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique
  eventType   String
  processedAt DateTime @default(now())
}
```

---

### 2.2 Audit Service — Schema 2.0

```prisma
// ============================================================
// AUDIT SERVICE — SCHEMA 2.0
// Key changes from v1:
//   • tenantId is NON-NULLABLE (legally required)
//   • Added: beforeSnapshot, afterSnapshot, sourceService,
//            moduleKey, ipAddress, userAgent
//   • Added: AuditRetentionPolicy, AuditExportJob models
//   • Added: rowHash for tamper detection (LLD-04 §11)
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// Immutable audit log — NO UPDATE, NO DELETE via application code.
/// Enforce via Prisma middleware or DB-level trigger.
model AuditEvent {
  id              String   @id @default(uuid())

  // Tenant context — MANDATORY, non-nullable
  tenantId        String
  correlationId   String

  // Actor
  actorType       AuditActorType
  actorId         String?  // null only for SYSTEM actors
  actorRole       String?

  // What happened
  moduleKey       String   // fees | exam | student | iam | tenant | config
  entityType      String   // Student | FeeReceipt | Exam
  entityId        String
  action          AuditAction

  // Evidence
  beforeSnapshot  Json?    // State before mutation
  afterSnapshot   Json?    // State after mutation
  reason          String?

  // Request context
  sourceService   String   // Which microservice emitted
  ipAddress       String?
  userAgent       String?

  // Tamper detection — SHA-256 of (id + tenantId + action + entityId + afterSnapshot)
  rowHash         String?

  createdAt       DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([tenantId, moduleKey])
  @@index([tenantId, entityType, entityId])
  @@index([correlationId])
  @@index([actorId])
}

enum AuditActorType {
  USER
  SYSTEM
  SCHEDULED_JOB
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  SOFT_DELETE
  RESTORE
  PUBLISH
  REVERSE
  APPROVE
  REJECT
  LOGIN
  LOGOUT
  LOGIN_FAILED
  EXPORT
  ASSIGN
  REVOKE
  IMPERSONATION_ATTEMPT
}

/// Per-tenant retention configuration for compliance schedules.
model AuditRetentionPolicy {
  id            String   @id @default(uuid())
  tenantId      String   @unique
  retentionDays Int      @default(2555)  // ~7 years default
  isActive      Boolean  @default(true)
  createdBy     String?
  updatedBy     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

/// Tracks background export jobs for compliance report generation.
model AuditExportJob {
  id          String          @id @default(uuid())
  tenantId    String
  requestedBy String
  status      ExportJobStatus @default(PENDING)
  filtersJson Json
  fileUrl     String?
  format      String          @default("csv")
  createdAt   DateTime        @default(now())
  completedAt DateTime?
  errorMsg    String?

  @@index([tenantId])
  @@index([status])
}

enum ExportJobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model ProcessedEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique
  eventType   String
  processedAt DateTime @default(now())
}
```

---

### 2.3 Config Service — Schema 2.0

```prisma
// ============================================================
// CONFIG SERVICE — SCHEMA 2.0
// Key changes from v1:
//   • Configuration model replaced — tenantCode → tenantId
//   • ConfigMaster gains: version, isActive, softDelete, audit fields
//   • Added: FeatureFlag model (LLD-03 §4.3)
//   • ModuleEntitlement gains: softDelete, enabledBy, disabledBy
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// Versioned configuration rows per tenant. One row = one config key at one version.
/// Rollback = set old row isActive=true, new row isActive=false.
model ConfigMaster {
  id          String   @id @default(uuid())
  tenantId    String
  configType  String   // GRADING | ACADEMIC | FEES_RULES | WORKFLOW | TIMETABLE_RULES | UI_SETTINGS
  configKey   String
  payload     Json
  version     Int      @default(1)
  isActive    Boolean  @default(true)
  softDelete  Boolean  @default(false)
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, configType, configKey, version])
  @@index([tenantId])
  @@index([tenantId, configType])
  @@index([tenantId, isActive])
}

/// Module on/off switch per tenant with change ownership tracking.
model ModuleEntitlement {
  id         String   @id @default(uuid())
  tenantId   String
  moduleKey  String
  enabled    Boolean  @default(false)
  enabledBy  String?
  disabledBy String?
  enabledAt  DateTime?
  disabledAt DateTime?
  softDelete Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([tenantId, moduleKey])
  @@index([tenantId])
}

/// Experimental feature flags — off by default, per-tenant toggle.
model FeatureFlag {
  id          String   @id @default(uuid())
  tenantId    String
  flagKey     String
  enabled     Boolean  @default(false)
  description String?
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, flagKey])
  @@index([tenantId])
}

model ProcessedEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique
  eventType   String
  processedAt DateTime @default(now())
}
```

---

### 2.4 Tenant Service — Schema Delta (targeted fixes)

Apply these targeted changes to the existing `tenant-service/prisma/schema.prisma`:

```prisma
// Replace:
//   status String @default("active")
// With enum:

enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  TERMINATED
}

// Add to Tenant model:
model Tenant {
  id          String       @id @default(uuid())
  code        String       @unique
  name        String
  legalName   String?
  status      TenantStatus @default(TRIAL)
  domain      String?
  trialEndDate DateTime?

  // Standard missing audit fields
  softDelete  Boolean  @default(false)
  version     Int      @default(1)
  createdBy   String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

> All other tenant-service models (Class, Section, Subject, Student, Exam, GradeScale, etc.) are **APPROVED** — they are correctly relational, tenant-indexed, and include audit fields. This is the best-designed schema in the platform.

---

## 3. Hardened API Blueprint

### 3.1 API Gateway — Responsibility Matrix

| Responsibility | Current Status | Required Action |
|---|---|---|
| JWT validation | ✅ Implemented via `@sme/auth` | No change needed |
| Tenant header injection | ✅ `x-tenant-id` propagated from JWT claims | No change needed |
| Tenant status enforcement | ✅ `TenantClientModule` present | Verify suspension → 403 path |
| Rate limiting | ❌ **MISSING** | Add `ThrottlerModule` |
| Module enforcement | ❌ **MISSING** | Add `ModuleGuard` |
| Idempotency key storage | ❌ **MISSING** | Add `IdempotencyInterceptor` |
| Correlation ID injection | ✅ Gateway generates UUID if absent | No change needed |
| Response envelope shaping | ✅ `ResponseEnvelopeInterceptor` exists | No change needed |

---

### 3.2 Rate Limiter — Implementation Specification

```typescript
// apps/api-gateway/src/app.module.ts — add:
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

ThrottlerModule.forRoot([
  {
    name:  'global',          // 2000 req/min per tenant
    ttl:   60_000,
    limit: 2000,
  },
  {
    name:  'user',            // 200 req/min per user
    ttl:   60_000,
    limit: 200,
  },
  {
    name:  'auth',            // 10 login attempts/min per IP
    ttl:   60_000,
    limit: 10,
  },
]),

// Provide as global guard:
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

**Login endpoint (`POST /iam/auth/token`) must use `@Throttle({ auth: {} })` override.**

---

### 3.3 Module Enforcement Guard — Specification

```typescript
// libs/auth/src/module.guard.ts
@Injectable()
export class ModuleGuard implements CanActivate {
  // Route prefix → module key map (from LLD-05 §5)
  private static readonly ROUTE_MODULE_MAP: Record<string, string> = {
    '/attendance': 'attendance',
    '/fees':       'fees',
    '/exam':       'exam',
    '/transport':  'transport',
    '/library':    'library',
    '/inventory':  'inventory',
    '/portal':     'portal',
    '/website':    'website',
    '/hr':         'hr',
  };

  constructor(private readonly configClient: ConfigClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    const path = request.path;

    // Platform routes bypass module check
    if (path.startsWith('/platform') || path.startsWith('/auth') || path.startsWith('/iam')) {
      return true;
    }

    const moduleKey = Object.keys(ModuleGuard.ROUTE_MODULE_MAP)
      .find(prefix => path.startsWith(prefix));

    if (!moduleKey || !tenantId) return true;

    const isEnabled = await this.configClient.isModuleEnabled(tenantId, moduleKey);
    if (!isEnabled) {
      throw new ForbiddenException({
        type: 'https://sme.example.com/errors/module-disabled',
        title: 'Module Not Enabled',
        status: 403,
        detail: `The '${moduleKey}' module is not enabled for this school.`,
        moduleKey,
      });
    }
    return true;
  }
}
```

---

### 3.4 Idempotency Key — Implementation Specification

**Contract:** Any `POST`, `PUT`, `PATCH`, `DELETE` endpoint MUST accept `x-idempotency-key` header. If the same key is received twice within TTL (24h), return the cached response immediately.

```typescript
// libs/common/src/idempotency.interceptor.ts
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    if (!mutationMethods.includes(request.method)) {
      return next.handle();
    }

    const rawKey = request.headers['x-idempotency-key'] as string | undefined;
    if (!rawKey) return next.handle();

    const tenantId = (request as any).user?.tenantId ?? 'platform';
    const keyHash = createHash('sha256').update(`${tenantId}:${rawKey}`).digest('hex');

    const existing = await this.repo.findOne({
      where: { tenantId, keyHash },
    });

    if (existing && existing.expiresAt > new Date()) {
      // Return cached response with 200 (not 201 — idempotent replay)
      const response = context.switchToHttp().getResponse();
      response.status(existing.responseStatus);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap(async (responseBody) => {
        const response = context.switchToHttp().getResponse();
        await this.repo.upsert(
          {
            tenantId,
            keyHash,
            requestPath: request.path,
            responseStatus: response.statusCode,
            responseBody,
            expiresAt: new Date(Date.now() + 86_400_000), // 24h TTL
          },
          ['tenantId', 'keyHash'],
        );
      }),
    );
  }
}
```

---

### 3.5 RFC 7807 Error Schema — Standard Error Codes

All error responses MUST conform to [RFC 7807 Problem Details](https://datatracker.ietf.org/doc/html/rfc7807):

```typescript
// Standard error payload structure
interface ProblemDetail {
  type:          string;  // URI reference: https://sme.example.com/errors/<code>
  title:         string;  // Human-readable short description
  status:        number;  // HTTP status code
  detail:        string;  // Human-readable long description
  instance?:     string;  // URI of the specific request causing the error
  correlationId: string;  // Always present — from x-correlation-id
  tenantId?:     string;  // Present when applicable
}
```

**Mandatory error code catalogue:**

| Error Code | HTTP | type URI | When |
|---|---|---|---|
| `TENANT_SUSPENDED` | 403 | `/errors/tenant-suspended` | Tenant status is SUSPENDED |
| `TENANT_NOT_FOUND` | 404 | `/errors/tenant-not-found` | tenantId does not exist |
| `INSUFFICIENT_PERMISSIONS` | 403 | `/errors/insufficient-permissions` | RBAC check fails |
| `MODULE_DISABLED` | 403 | `/errors/module-disabled` | Module not enabled for tenant |
| `TOKEN_EXPIRED` | 401 | `/errors/token-expired` | JWT exp exceeded |
| `TENANT_MISMATCH` | 403 | `/errors/tenant-mismatch` | x-tenant-id spoofing attempt |
| `IDEMPOTENCY_CONFLICT` | 409 | `/errors/idempotency-conflict` | Same key, different payload hash |
| `RESOURCE_CONFLICT` | 409 | `/errors/resource-conflict` | Optimistic lock version mismatch |
| `VALIDATION_ERROR` | 400 | `/errors/validation-error` | DTO validation failure |
| `RATE_LIMIT_EXCEEDED` | 429 | `/errors/rate-limit-exceeded` | Throttler limit hit |
| `SERVICE_UNAVAILABLE` | 503 | `/errors/service-unavailable` | Downstream service unreachable |
| `ACCOUNT_LOCKED` | 423 | `/errors/account-locked` | User locked after failed attempts |

---

### 3.6 Granular Endpoint Inventory

#### IAM Service (`/iam`)
```
POST   /iam/auth/token                          → Issue access token (Public)
POST   /iam/auth/refresh                        → Rotate refresh token (Public+Token)
POST   /iam/auth/logout                         → Revoke session tokens
POST   /iam/auth/forgot-password                → Request password reset link (Public)
POST   /iam/auth/reset-password                 → Consume token & set new password (Public)
GET    /iam/auth/me                             → Resolve authenticated user claims

POST   /iam/users                               → Create user [PERM: USER_CREATE]
GET    /iam/users                               → List users (paginated) [PERM: USER_READ]
GET    /iam/users/:userId                       → Get user by ID [PERM: USER_READ]
PATCH  /iam/users/:userId                       → Update user profile [PERM: USER_UPDATE]
POST   /iam/users/:userId/suspend               → Suspend user [PERM: USER_SUSPEND]
POST   /iam/users/:userId/reset-password        → Admin-initiated reset [PERM: USER_UPDATE]

POST   /iam/roles                               → Create role [PERM: ROLE_CREATE]
GET    /iam/roles                               → List roles [PERM: ROLE_READ]
PATCH  /iam/roles/:roleId                       → Update role [PERM: ROLE_UPDATE]
DELETE /iam/roles/:roleId                       → Soft delete role [PERM: ROLE_DELETE]
POST   /iam/roles/:roleId/permissions/:permCode → Assign permission [PERM: ROLE_ASSIGN]
DELETE /iam/roles/:roleId/permissions/:permCode → Revoke permission [PERM: ROLE_ASSIGN]

POST   /iam/users/:userId/roles/:roleCode       → Assign role to user [PERM: ROLE_ASSIGN]
DELETE /iam/users/:userId/roles/:roleCode       → Remove role from user [PERM: ROLE_ASSIGN]

GET    /iam/permissions                         → List all platform permissions [PERM: ROLE_READ]
```

#### Config Service (`/config`)
```
GET    /config/modules                          → Get enabled modules for tenant
POST   /config/modules/:moduleKey/enable        → Enable module [PERM: CONFIG_MODULE_MANAGE]
POST   /config/modules/:moduleKey/disable       → Disable module [PERM: CONFIG_MODULE_MANAGE]

GET    /config/:type/:key                       → Get config by type+key (latest active version)
PUT    /config/:type/:key                       → Upsert config (creates new version) [PERM: CONFIG_UPDATE]
GET    /config/:type/:key/history               → List versions [PERM: CONFIG_READ]
POST   /config/:type/:key/rollback/:version     → Rollback to version [PERM: CONFIG_UPDATE]

POST   /config/feature-flags/:flagKey/enable    → Enable feature flag [PERM: CONFIG_UPDATE]
POST   /config/feature-flags/:flagKey/disable   → Disable feature flag [PERM: CONFIG_UPDATE]
GET    /config/feature-flags                    → List feature flags [PERM: CONFIG_READ]
```

#### Audit Service (`/audit`)
```
GET    /audit/logs                              → Search logs (filtered, paginated) [PERM: AUDIT_VIEW]
GET    /audit/logs/:auditId                     → Get single audit record [PERM: AUDIT_VIEW]
POST   /audit/export                            → Create export job [PERM: AUDIT_EXPORT]
GET    /audit/export/:jobId                     → Get export job status [PERM: AUDIT_EXPORT]
GET    /audit/entity/:entityType/:entityId      → Full history for one entity [PERM: AUDIT_VIEW]
```

#### Academic Service (`/academic`) — future service
```
POST   /academic/years                          → Create academic year [PERM: ACADEMIC_MANAGE]
GET    /academic/years                          → List academic years [PERM: ACADEMIC_READ]
PATCH  /academic/years/:yearId/activate         → Set active year [PERM: ACADEMIC_MANAGE]

POST   /academic/classes                        → Create class [PERM: ACADEMIC_MANAGE]
GET    /academic/classes                        → List classes [PERM: ACADEMIC_READ]
POST   /academic/classes/:classId/sections      → Create section [PERM: ACADEMIC_MANAGE]
POST   /academic/subjects                       → Create subject [PERM: ACADEMIC_MANAGE]
GET    /academic/subjects                       → List subjects [PERM: ACADEMIC_READ]

POST   /academic/teachers                       → Register teacher profile [PERM: HR_MANAGE]
POST   /academic/assignments                    → Assign teacher to class+section [PERM: ACADEMIC_MANAGE]
GET    /academic/assignments                    → List assignments [PERM: ACADEMIC_READ]
```

---

## 4. Inter-Service Reliability Design

### 4.1 Auth Handshake — Dependency Trace (No Circular Deps)

**Problem Statement:** IAM needs tenant status to block suspended tenants. Tenant service needs IAM to create admin users. How do we prevent a circular dependency?

**Solution: One-Way Dependency with Gateway Mediation**

```
                        ┌─────────────────────────────────────────┐
                        │            API GATEWAY                  │
                        │  1. Validate JWT (local, no network)    │
                        │  2. Extract tenantId from claims        │
                        │  3. Check tenant cache (Redis)          │
                        │  4. If SUSPENDED → 403 immediately      │
                        │  5. Forward request with x-tenant-id    │
                        └──────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │     ModuleEntitlement check          │
                    │  config-service Redis cache          │
                    │  modules:{tenantId} key              │
                    └──────────────────┬──────────────────┘
                                       │
                               reaches IAM service
                                  (no DB hit needed for validating
                                   tenant status — already done)
```

**Key Design Decisions:**
1. **Tenant status lives in Redis gateway cache** — refreshed on `TenantStatusChanged` event. IAM never calls Tenant service.
2. **IAM creates users; Tenant service calls IAM** — only in this direction. Tenant service → IAM via internal HTTP with service token, never the reverse.
3. **JWT claims carry `tenantStatus`** — encoded at token issuance. Expired tokens re-authenticate against fresh tenant status.

---

### 4.2 Asynchronous Audit Without Latency Impact

**Pattern: Transactional Outbox**

```
Business Service (e.g., fees-service)
   │
   ├── 1. BEGIN TRANSACTION
   │       • Write business record (e.g., FeeReceipt)
   │       • Write OutboxEvent row in SAME transaction
   │   COMMIT
   │
   └── 2. Outbox Relay (background polling, every 100ms)
           • Read unpublished OutboxEvent rows
           • Publish to RabbitMQ exchange: audit.events
           • Mark row as published
           │
           └── 3. Audit Service consumes from queue
                   • Validates payload
                   • Writes AuditEvent (non-blocking to caller)
                   • On failure: DLQ with retry backlog
```

**This guarantees:**
- Zero increase in API response latency (audit write is async)
- Zero audit loss (outbox sits in the same transaction as business data)
- Replay capability (outbox events can be re-published from the relay)

**Outbox Table (add to each business service DB):**
```prisma
model OutboxEvent {
  id          String    @id @default(uuid())
  tenantId    String
  eventType   String
  payload     Json
  published   Boolean   @default(false)
  publishedAt DateTime?
  attempts    Int       @default(0)
  createdAt   DateTime  @default(now())

  @@index([published, createdAt])
  @@index([tenantId])
}
```

---

### 4.3 Module Entitlement Without Service-Call Overhead

```
                ┌──────────────────────────────────────────┐
                │         Startup / ModuleEnabled Event     │
                │                                          │
                │  config-service → publishes              │
                │  ModuleEnabled/ModuleDisabled event       │
                └──────────────────┬───────────────────────┘
                                   │ RabbitMQ topic: config.module
                                   │
          ┌────────────────────────▼─────────────────────────────┐
          │              API Gateway Consumer                     │
          │                                                       │
          │  Receives event → updates Redis:                      │
          │    SET modules:{tenantId}  JSON({k:bool,...})  EX 300 │
          └──────────────────────────────────────────────────────┘
```

The gateway **never makes a synchronous HTTP call to config-service** for module checks. It reads from its own Redis cache only, keeping p99 latency impact < 1ms.

---

### 4.4 Circuit Breaker Specification

Each gateway-to-service proxy call MUST be wrapped with:

```typescript
// Implementation recommendation: @nestjs/axios + opossum circuit breaker
const breaker = new CircuitBreaker(serviceHttpCall, {
  timeout:          3000,   // 3s threshold
  errorThresholdPercentage: 50,
  resetTimeout:     30_000, // 30s open → half-open
  volumeThreshold:  5,      // min calls before tripping
});

breaker.fallback(() => {
  throw new ServiceUnavailableException({
    type:   'https://sme.example.com/errors/service-unavailable',
    title:  'Downstream Service Unavailable',
    status: 503,
    detail: 'The requested service is temporarily unreachable. Please retry.',
  });
});
```

**Circuit breaker required for:**  IAM, Tenant, Config, Audit (all gateway → service calls).

---

## 5. Enterprise DevOps & Resilience

### 5.1 Zero-Downtime Prisma Migration Strategy

**Problem:** Running `prisma migrate deploy` while services are live can cause a window where old code reads new schema or vice versa.

**3-Phase Migration Protocol:**

| Phase | Action | Both App Versions Compatible? |
|---|---|---|
| **Phase 1 — Expand** | Add new columns as `nullable` or with defaults. Add new tables. Never remove old columns. | ✅ Yes |
| **Phase 2 — Migrate** | Run data backfill scripts (async, off-peak). Flip `nullable → non-nullable` only after 100% data fill. | ✅ Yes |
| **Phase 3 — Contract** | Remove old columns/tables ONLY after old app version is fully drained. | ✅ Yes |

**CI/CD Enforcement:**
```yaml
# .github/workflows/migrate.yml
steps:
  - name: Shadow DB Validation
    run: npx prisma migrate diff --from-schema-datasource --to-schema-datamodel --shadow-database-url $SHADOW_URL

  - name: Dry Run
    run: npx prisma migrate deploy --preview-feature

  - name: Apply (production)
    run: npx prisma migrate deploy
    env:
      DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

**Rollback Strategy:**
- Every migration MUST have a corresponding `Down` SQL script maintained in `prisma/migrations/<name>/down.sql`
- Automated test: run migrate up → run down → confirm schema matches baseline

---

### 5.2 Correlation ID — Full Request Trace Specification

```
Browser / Mobile
    │ Generates: x-correlation-id: uuid-v4    (or gateway generates if absent)
    │
    ▼
API Gateway
    │ Logs: {correlationId, method, path, tenantId, userId, ip, timestamp}
    │ Injects into ALL downstream headers: x-correlation-id
    │
    ▼
IAM / Config / Tenant / Audit (any service)
    │ Reads x-correlation-id from incoming request
    │ Attaches to its own log context (AsyncLocalStorage / CLS)
    │ ALL log lines emitted during this request contain: {correlationId}
    │ Emits events with: correlationId in envelope
    │
    ▼
RabbitMQ Events
    │ Event envelope always carries: { correlationId, tenantId }
    │
    ▼
Audit Service
    │ Stores correlationId in AuditEvent.correlationId (indexed)
    │
    ▼
Observability Stack (e.g., Grafana Loki / ELK)
      Query: correlationId = "abc-123"
      → Collects logs from ALL services for one user request
```

**NestJS Implementation:**
```typescript
// libs/logger/src/correlation.middleware.ts
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] as string || randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    // Attach to AsyncLocalStorage for propagation to all log calls
    correlationStore.run({ correlationId }, next);
  }
}
```

---

### 5.3 Observability Requirements Stack

| Layer | Tool | What to Monitor |
|---|---|---|
| **Structured Logs** | Winston + Pino JSON → Loki/ELK | Every request: correlationId, tenantId, userId, latency, status |
| **Metrics** | Prom-client → Prometheus → Grafana | RPS, p95/p99 latency, error rate, DB pool exhaustion, queue depth |
| **Distributed Trace** | OpenTelemetry → Jaeger/Tempo | Full request trace across gateway → service → DB → event |
| **Alerting** | Grafana Alerting | Error rate > 1%, p99 > 2s, DB connections > 80%, DLQ depth > 100 |
| **Uptime** | Healthcheck endpoints | `/health/live` (process alive), `/health/ready` (DB + Redis alive) |

---

## 6. Revisit List

> Items not in the original audit prompt but identified as critical architectural gaps during this review.

### R-01 — Outbox Table Missing from All Business Services
All business services (fees, attendance, exam, student, etc.) need an `OutboxEvent` table for the transactional outbox pattern. Without it, audit events can be lost on service crash between business write and message publish.

### R-02 — `version` Field and Optimistic Locking Not Enforced
`version Int @default(1)` exists in many models but there is no Prisma middleware or service-layer code that:
1. Increments `version` on UPDATE
2. Checks `WHERE version = :expectedVersion` before update (optimistic lock)
This must be implemented in a shared Prisma middleware in `libs/common`.

### R-03 — No Tenant Status Cache Invalidation Subscriber in Gateway
The gateway imports `TenantClientModule` but there is no RabbitMQ consumer in the gateway that listens to `TenantStatusChanged` events to invalidate its Redis tenant cache. A tenant could be suspended but the cache keeps serving requests for up to the TTL window.

### R-04 — `ProcessedEvent` Table Needs Index on `createdAt` for Cleanup
All services have a `ProcessedEvent` table for idempotent event consumption. Without a `createdAt` index and a TTL cleanup job, this table will grow unboundedly and become a performance bottleneck.

### R-05 — No `@db.VarChar(n)` Length Constraints on Any String Field
All `String` fields across all schemas map to `text` in PostgreSQL (unlimited length). Enterprise-grade schemas need explicit `@db.VarChar(255)` or `@db.VarChar(500)` constraints on fields like `email`, `name`, `code`, `status` to prevent oversized payloads corrupting reports and causing DB storage anomalies.

### R-06 — No Soft-Delete Filter at ORM Level (Global Prisma Middleware)
`softDelete Boolean @default(false)` exists on most models but there is no Prisma client middleware that automatically appends `WHERE softDelete = false` to all `findMany`/`findOne` queries. Without this, deleted records silently appear in API responses.

### R-07 — GradeScale is in tenant-service, LLD specifies it in config-service
`GradeScale` is correctly relational (GOOD) but placed in `tenant-service`. LLD-03 specifies grading rules belong to Config Service under category `GRADING`. Consider moving `GradeScale` to config-service as a first-class relational table rather than a JSON blob in `ConfigMaster`.

### R-08 — No Health Check for RabbitMQ in `ready` Endpoint
`/health/ready` should check RabbitMQ connectivity in addition to DB and Redis. A service that cannot publish audit events should not be considered "ready" and should be removed from the load balancer pool.

### R-09 — No API Versioning Strategy Defined
HLD and LLD are silent on API versioning. Before going to production with external consumers, define whether SME uses URL versioning (`/v1/students`) or header versioning (`Accept: application/vnd.sme.v1+json`). Once external integrators exist, changing this is a breaking migration.

### R-10 — Subscription / Plan Entitlement Validation in ModuleEnable Flow
`POST /config/modules/:moduleKey/enable` should call subscription-service to verify the tenant's plan includes that module. This validation is specified in LLD-03 §7 but no `SubscriptionClientModule` exists yet. This creates a pathway for modules to be enabled without a paid subscription.

---

## Architectural Health Scorecard

| Domain | Score | Rating |
|---|---|---|
| Tenant Isolation (schema) | 5/10 | IAM email/role not scoped → CRITICAL |
| Relational Data Design | 8/10 | tenant-service is excellent; others need work |
| Audit & Compliance | 4/10 | Nullable tenantId, missing snapshots → CRITICAL |
| API Security | 6/10 | JWT good; idempotency/rate-limit missing |
| Inter-Service Reliability | 5/10 | No outbox, no circuit breaker, no DLQ handling |
| DevOps Readiness | 5/10 | No migration strategy, no correlation propagation |
| Observability | 6/10 | Logger lib exists; metrics/tracing not wired |
| **Overall** | **5.6/10** | **Not production-ready — fix RISK-01 to RISK-07 first** |

---

*This report was generated by architectural audit of live codebase against BRD v1.0, SRS v1.0, HLD v1.0, and LLD-01 through LLD-05. All findings are evidence-based against actual Prisma schemas and NestJS source files.*
