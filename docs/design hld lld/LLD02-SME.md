


Excellent.
From this point forward, I will drive:

🧠 Architecture & Design (me)

🤖 Code generation execution (Copilot / GPT-5.3-Codex)

🧭 Build sequence discipline (strict order)

You will not start coding until I say BUILD GATE 1: START COPILOT.

Now proceeding with:

LLD-02 — Tenant Management Service
This service is foundational.
Every other service depends on tenant lifecycle and isolation.

1. Tenant Service Scope
Responsibilities
Create tenant (school)

Maintain tenant lifecycle

Store tenant metadata

Map tenant to subscription plan

Manage tenant-level administrators

Expose tenant status to gateway

Enforce soft delete only

Emit lifecycle events

Non-Responsibilities
Authentication logic (IAM)

Module enablement (Config service)

Billing calculation (Subscription service)

Audit storage (Audit service)

2. Core Design Decisions
Multi-Tenant Model
Single platform

Tenant = school

Isolation = row-level via tenant_id

Premium plan future-ready for dedicated DB

Tenant Lifecycle States
TRIAL

ACTIVE

SUSPENDED

TERMINATED (soft)

ARCHIVED (optional future)

Rule:

Only ACTIVE tenants can access business modules.

SUSPENDED blocks API access at Gateway.

3. Data Model (Tenant Service DB)
All tables contain:

id (UUID)

created_at

updated_at

created_by

updated_by

is_deleted (soft delete)

3.1 tenants
Field	Type	Notes
id	UUID	Primary key
tenant_code	varchar	Unique short code (e.g., SME001)
school_name	varchar	Required
legal_name	varchar	Optional
status	enum	TRIAL / ACTIVE / SUSPENDED / TERMINATED
trial_end_date	datetime	Nullable
primary_contact_name	varchar	Required
primary_contact_email	varchar	Required
primary_contact_phone	varchar	Required
address_line1	varchar	
city	varchar	
state	varchar	
country	varchar	
timezone	varchar	Default IST
logo_url	varchar	File-service link
default_language	varchar	e.g., en
subscription_plan_id	UUID	FK reference (subscription service)
metadata_json	jsonb	flexible future extensions
Unique:

tenant_code

primary_contact_email (optional decision: platform-level unique)

3.2 tenant_admins
Maps which users (IAM) are super admins of tenant.

Field	Type
id	UUID
tenant_id	UUID
user_id	UUID
is_primary	boolean
Unique:

(tenant_id, user_id)

3.3 tenant_domains (future ready)
For subdomain mapping.

Field	Type
id	UUID
tenant_id	UUID
domain	varchar
is_verified	boolean
verified_at	datetime
Unique:

domain

3.4 tenant_branches (multi-campus ready)
Field	Type
id	UUID
tenant_id	UUID
branch_code	varchar
branch_name	varchar
address	varchar
is_active	boolean
Unique:

(tenant_id, branch_code)

4. Tenant APIs (Detailed)
All follow standard envelope + headers.

4.1 Platform Super Admin APIs
1) Create Tenant
POST /platform/tenants

Input:

{
  schoolName,
  primaryContactName,
  primaryContactEmail,
  primaryContactPhone,
  planId,
  trialDays (optional)
}
Validation:

planId must exist (subscription service validation via REST)

email format valid

tenant_code auto-generated (configurable pattern)

Business Rules:

Create tenant in TRIAL (if trialDays provided)

Create primary admin user via IAM service

Emit:

TenantCreated

AuditEventRequested

Response:

{
  tenantId,
  tenantCode,
  adminUserId
}
2) Activate Tenant
POST /platform/tenants/{tenantId}/activate

Rules:

Plan must be valid

Trial may convert to ACTIVE

Emit:

TenantStatusChanged

3) Suspend Tenant
POST /platform/tenants/{tenantId}/suspend

Input:

{ reason }
Rules:

Gateway must block future access

Active sessions invalidated (IAM revoke refresh tokens)

Emit:

TenantStatusChanged

4) Update Tenant Metadata
PATCH /platform/tenants/{tenantId}

Allow:

address

timezone

logo_url

contact info

5) List Tenants
GET /platform/tenants?page=1&size=20&status=ACTIVE

4.2 Tenant-Scoped APIs (School Admin Use)
6) Get My Tenant
GET /tenant/me

Return:

school info

branch list

status

plan info

logo

7) Update Branding
PATCH /tenant/branding

Input:

{
  logoUrl,
  primaryColor,
  secondaryColor,
  websiteEnabled (bool)
}
Note:
Full website config handled later in Website module.

8) Manage Branches
POST /tenant/branches
PATCH /tenant/branches/{branchId}
GET /tenant/branches

5. Business Rules (Strict)
A TERMINATED tenant cannot be reactivated without platform approval.

Soft delete only (is_deleted = true).

Tenant suspension must:

Invalidate IAM sessions.

Prevent Gateway routing.

Tenant creation must:

Trigger Config service to seed default configs.

Trigger Subscription service to initialize plan usage.

Tenant cannot downgrade plan if usage exceeds limit (subscription service validation).

6. Events Published
TenantCreated
Payload:

{
  tenantId,
  tenantCode,
  schoolName,
  status,
  planId,
  trialEndDate,
  primaryAdminUserId
}
TenantStatusChanged
{
  tenantId,
  oldStatus,
  newStatus,
  changedBy,
  reason
}
TenantUpdated
{
  tenantId,
  changedFields,
  oldValues,
  newValues
}
7. Inter-Service Dependencies
Calls Made
IAM Service → create primary admin

Subscription Service → validate plan

Config Service → seed defaults (async event)

Audit Service → via event

Events Consumed
PlanExpired (from subscription service)

8. Gateway Enforcement
Gateway must:

Check tenant status on every request

If SUSPENDED → return 403

Cache tenant status (TTL configurable)

Invalidate cache on TenantStatusChanged event

9. Security Considerations
Only Platform Super Admin role can access /platform/*

Tenant Admin cannot see other tenants

Domain verification required before custom domain enabled

Sensitive updates require audit

10. Observability
Tenant service must expose:

/health/live

/health/ready

Metrics:

tenants by status

trial conversions

suspensions count

Summary: LLD-02 Complete
Tenant service now fully defined:

Schema

APIs

Lifecycle

Events

Security

Gateway interaction

Next:
LLD-03 — Configuration Service
(This is critical for module toggles, workflow config, grading rules, templates, etc.)

After LLD-05 we will hit:

🚦 BUILD GATE 1: START COPILOT

Proceeding to LLD-03 next.


