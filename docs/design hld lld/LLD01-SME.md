

Saved ✅ (your passion + lifelong mission “SOLVING UNDERUTILIZATION” + your empowerment models are now in my main memory.)

Now — LLD starts now.

I will also be very clear about exactly when you should start feeding Copilot so you don’t waste premium requests.

LLD Master Plan for SME (Microservices)
We will produce LLD in packs. Each pack ends with a “Copilot Build Gate” (green signal) so coding begins only when dependencies are stable.

Copilot Build Gate Strategy (when you start coding)
You will start Copilot coding after LLD Pack 1 is complete because every service depends on auth/tenant/config/audit/gateway conventions.

✅ Copilot Build Gate 1 (Start Coding)
When these are finalized:

API Contract Standard (already done in HLD Appendix B)

IAM LLD (tables + token claims + RBAC/ABAC)

Tenant LLD (tenant onboarding + lifecycle)

Config LLD (module toggles + versioning)

Audit LLD (immutable audit logging)

API Gateway LLD (routes, auth enforcement, tenant resolution, rate limiting)

At that point, you will create the repo skeleton in C:\projects\SME and Copilot will start coding the Platform Core services first.

✅ Copilot Build Gate 2
After Student + Master Data LLD is complete → Copilot builds those services.

✅ Copilot Build Gate 3
After Attendance + Academic + Exam LLD is complete → Copilot builds those services.

…and so on.

This prevents rewrite and “Copilot wandering.”

LLD Pack 1 — Platform Core
LLD-01: Identity & Access Service (IAM)
(Everything below is implementation-grade, but still LLD—not code.)

1) IAM Service Scope
Responsibilities
Authentication (login)

Authorization (RBAC + ABAC)

Tenant-scoped users

JWT token issuing (access + refresh)

Password policy enforcement

Account lockout

User lifecycle (create/suspend/reset)

Role and permission management

Policy evaluation

Non-Responsibilities (NOT in IAM)
Tenant creation (Tenant service)

Module toggles (Config service)

Audit storage (Audit service) — IAM only emits audit events

2) IAM Service Interfaces
External Interfaces
REST APIs via API Gateway

Publishes events to message broker

Requests audit logging via AuditEventRequested

Internal Dependencies
Reads tenant status from Tenant Service (cached) OR via Tenant-Status cache at Gateway

Reads module enablement from Config Service only for optional portal login gating

3) Authentication Model
Login Modes (Phase 1)
Email + password

Username + password

Token Types
Access Token (JWT): short-lived (e.g., 15 minutes)

Refresh Token: longer-lived (e.g., 7–30 days, configurable)

JWT Claims (mandatory)
sub = userId

tenantId

tenantStatus

roles = list of role keys

permissions (optional if using policy evaluation server-side only)

sessionId

iat, exp

Enterprise rule: Do not bloat JWT with thousands of permissions.
Recommended: include roles + minimal flags; evaluate permissions server-side (RBAC tables + caching).

4) Authorization Model (RBAC + ABAC)
RBAC
Roles are tenant-scoped (same role name can exist across tenants)

Permissions are platform-defined constants (e.g., STUDENT_READ, FEE_REVERSE)

ABAC (attributes)
Used to restrict within tenant. Examples:

Teacher can access only their assigned classes

Accounts can access only Fees module

Campus admin can access only a campus

ABAC inputs:

user attributes: department, designation, campusId

resource attributes: classId, campusId, entityOwnerId

context attributes: time, module enabled, academic year

5) IAM Data Model (Tables)
All tables contain: id (UUID), tenant_id, created_at, updated_at, is_deleted, plus audit fields.

5.1 users
id

tenant_id

email (nullable if username used)

username (nullable if email used)

phone (future)

password_hash

status = ACTIVE | SUSPENDED | LOCKED | PENDING_RESET

failed_login_count

last_failed_login_at

locked_until (nullable)

last_login_at

must_change_password (bool)

display_name

primary_role_hint (optional)

Unique constraints:

(tenant_id, email) where email not null

(tenant_id, username) where username not null

5.2 roles
id

tenant_id

role_key (e.g., SCHOOL_ADMIN, TEACHER)

role_name (display)

description

is_system_role (bool)

Unique: (tenant_id, role_key)

5.3 permissions
Platform-defined permissions live here for discoverability (seeded).

id

permission_key (global unique)

permission_name

module_key (fees/attendance/exam/etc.)

Unique: (permission_key)

5.4 role_permissions
id

tenant_id

role_id

permission_id

Unique: (tenant_id, role_id, permission_id)

5.5 user_roles
id

tenant_id

user_id

role_id

Unique: (tenant_id, user_id, role_id)

5.6 user_attributes (ABAC attributes)
Flexible key-value.

id

tenant_id

user_id

attr_key (e.g., campusId, departmentId)

attr_value

Unique: (tenant_id, user_id, attr_key)

5.7 refresh_tokens
id

tenant_id

user_id

session_id

token_hash (store hash only)

issued_at

expires_at

revoked_at (nullable)

revoked_reason (nullable)

Indexes: (tenant_id, user_id), (token_hash)

5.8 password_reset_tokens
id

tenant_id

user_id

token_hash

issued_at

expires_at

used_at

5.9 login_audit (optional, lightweight; real audit goes to Audit service)
id

tenant_id

user_id (nullable if unknown username attempt)

login_identifier (email/username)

success (bool)

ip

user_agent

created_at

6) IAM APIs (Endpoint-Level LLD)
All APIs follow HLD Appendix B envelope + headers.

6.1 Auth APIs
POST /auth/login

Input:

identifier (email or username)

password

Validations:

tenant must be ACTIVE (from token? for login we resolve tenant by identifier domain or tenant selection screen)

Output:

accessToken, refreshToken, expiresIn, userProfileBasic

Side effects:

update last_login_at

reset failed count

emit AuditEventRequested = LOGIN_SUCCESS

on failure: increment failed count; lock if threshold exceeded; emit LOGIN_FAILED

POST /auth/refresh

Input: refreshToken

Output: new access token (and optionally rotate refresh token)

Rules:

refresh token must be valid, not revoked, not expired

rotate tokens (enterprise recommended)

POST /auth/logout

Input: refresh token OR sessionId

Behavior:

revoke refresh tokens for that session

emit audit event LOGOUT

6.2 User Admin APIs (Tenant-scoped)
POST /users

Create user

Requires permission: IAM_USER_CREATE

GET /users

Filter by status/role/department

GET /users/{userId}

PATCH /users/{userId}

Update profile fields & status

If changing status: audit required

POST /users/{userId}/reset-password

Generates reset token (or sets must_change_password)

Emits notification request event (later)

6.3 Role & Permission APIs
POST /roles

GET /roles

PATCH /roles/{roleId}

POST /roles/{roleId}/permissions

DELETE /roles/{roleId}/permissions/{permissionId}

POST /users/{userId}/roles

DELETE /users/{userId}/roles/{roleId}

7) Validation & Business Rules (No ambiguity)
A user cannot be ACTIVE if tenant is SUSPENDED.

Role deletion:

system roles cannot be deleted

cannot delete role if assigned to any user (must unassign first) OR allow soft delete with enforcement; choose one:

Enterprise choice: soft delete role + prevent future assignment; keep history.

Password reset token:

single use

expires in configurable time (default 30 minutes)

Lockout:

5 failed attempts → LOCKED for 15 minutes (configurable)

Refresh token:

stored only as hash

revoke on logout, reset password, user suspension

8) IAM Events Published
UserCreated

UserRoleChanged

UserSuspended

PasswordResetRequested (future)

AuditEventRequested for:

login success/fail

user create/update/suspend

role changes

9) Caching (Enterprise Practical)
Cache role-permission map per tenant in Redis:

key: rbac:{tenantId}:{roleId}

Invalidate cache when:

role permissions updated

user roles updated

10) Security & Compliance Notes
Never log password / tokens.

Mask login identifier in logs where possible.

Rate limit login endpoint (per IP + per identifier).

Enforce correlationId everywhere.

✅ LLD Deliverable Output for IAM (What Copilot will receive later)
When we reach Build Gate 1, you will feed Copilot:

Table definitions

API list + request/response DTOs

Auth flow rules

JWT claim structure

Events list + payload

Security rules

Next LLD Sections (continuing Pack 1)
In the very next step, I will produce:

LLD-02 Tenant Service
LLD-03 Configuration Service
LLD-04 Audit Service
LLD-05 API Gateway Policies & Route Map
…and then we trigger Copilot Build Gate 1.

Quick instruction for your workspace
Since you already have C:\projects\SME ready:

Don’t code yet.

After LLD-05, I’ll give you an exact “Copilot Prompt Pack” to generate:

repo structure

docker compose / k8s-ready layout

service scaffolds

shared libs (auth middleware, response envelope, correlation)

Now, I’m proceeding to LLD-02 (Tenant Service) next.




