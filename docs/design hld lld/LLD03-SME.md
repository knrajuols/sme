

Excellent.
Now proceeding with:

LLD-03 — Configuration Service
(One of the most critical services in SME — this is what makes your platform configurable instead of hardcoded.)

1. Configuration Service Scope
Responsibilities
Module enable/disable per tenant

Academic year configuration

Grading rules configuration

Fee structure templates (high-level rules, not invoices)

Workflow approval rules

Timetable rules

Notification templates

Report card templates metadata

Feature flags

Versioning of configuration

Rollback support

Emit config change events

Provide fast config snapshot for other services

Non-Responsibilities
Tenant lifecycle (Tenant service)

Billing/plan enforcement (Subscription service)

Actual report card generation (Exam service)

Notification sending (Communication service)

2. Core Design Philosophy
This service is:

Tenant-scoped

Versioned

Highly cached

Read-heavy

Write-controlled

Every config change:

Creates a new version

Emits ConfigUpdated

Clears relevant caches

3. Configuration Categories
We separate config into categories to prevent chaos.

Category	Description
MODULES	Enabled/disabled modules
ACADEMIC	Academic year + promotion rules
GRADING	Grade boundaries + calculation logic
FEES_RULES	Fine rules, concession logic
WORKFLOW	Approval flows
TIMETABLE_RULES	Conflict rules, max periods
NOTIFICATION_TEMPLATES	Template texts
REPORT_TEMPLATES	Metadata for report card format
UI_SETTINGS	Theme, branding flags
FEATURE_FLAGS	Experimental flags
4. Data Model (Config Service DB)
All tables include:

id

tenant_id

version

created_at

created_by

is_active

is_deleted

4.1 config_master
Stores configuration metadata per category.

Field	Type
id	UUID
tenant_id	UUID
category	enum
config_key	varchar
version	integer
config_json	jsonb
is_active	boolean
Unique:

(tenant_id, category, config_key, version)

4.2 module_entitlements
Stores which modules are enabled for tenant.

Field	Type
id	UUID
tenant_id	UUID
module_key	varchar
is_enabled	boolean
enabled_by	UUID
enabled_at	datetime
Unique:

(tenant_id, module_key)

4.3 feature_flags
Field	Type
id	UUID
tenant_id	UUID
flag_key	varchar
is_enabled	boolean
description	varchar
Unique:

(tenant_id, flag_key)

4.4 workflow_rules
Field	Type
id	UUID
tenant_id	UUID
workflow_key	varchar
version	integer
definition_json	jsonb
is_active	boolean
5. JSON Config Structure Examples
This prevents ambiguity for Copilot later.

5.1 Module Config JSON
Example stored in config_master with category MODULES:

{
  "attendance": true,
  "fees": true,
  "exam": true,
  "transport": false,
  "library": false,
  "inventory": false,
  "portal": true,
  "website": true
}
5.2 Academic Year Config
{
  "currentAcademicYearId": "uuid",
  "promotionPolicy": {
    "autoPromote": true,
    "requireApproval": false
  },
  "academicYears": [
    {
      "id": "uuid",
      "name": "2025-2026",
      "startDate": "2025-06-01",
      "endDate": "2026-03-31",
      "isActive": true
    }
  ]
}
5.3 Grading Rules
{
  "type": "percentage",
  "grades": [
    { "min": 90, "max": 100, "grade": "A+" },
    { "min": 75, "max": 89, "grade": "A" },
    { "min": 60, "max": 74, "grade": "B" },
    { "min": 40, "max": 59, "grade": "C" },
    { "min": 0, "max": 39, "grade": "F" }
  ],
  "rounding": "nearest"
}
5.4 Workflow Rules (Example: Result Publish Approval)
{
  "steps": [
    { "role": "TEACHER", "action": "SUBMIT" },
    { "role": "ACADEMIC_COORDINATOR", "action": "REVIEW" },
    { "role": "PRINCIPAL", "action": "APPROVE" }
  ],
  "allowOverride": false
}
6. APIs
All APIs are tenant-scoped unless /platform/*.

6.1 Module Management
GET Enabled Modules
GET /config/modules

Response:

{
  "attendance": true,
  "fees": true,
  "exam": true
}
Enable Module
POST /config/modules/{moduleKey}/enable

Validation:

Must check subscription entitlement via Subscription Service

Emit:

ModuleEnabled

AuditEventRequested

Disable Module
POST /config/modules/{moduleKey}/disable

6.2 Config CRUD
Get Config by Category
GET /config/{category}/{configKey}

Example:
GET /config/GRADING/default

Update Config
PUT /config/{category}/{configKey}

Rules:

Create new version

Set old version inactive

Emit ConfigUpdated event

Audit event mandatory

Rollback Config
POST /config/{category}/{configKey}/rollback/{version}

7. Business Rules
Cannot enable module if subscription plan disallows.

Disabling module must:

Hide in UI

Gateway block routes

Service must reject calls (defensive)

Config changes must be versioned.

Only Tenant Admin can update config.

Config changes after exam publish must not retroactively alter grades unless reprocessed manually.

8. Inter-Service Interaction
Calls Made
Subscription Service → validate entitlement

Audit Service → via event

Events Published
ConfigUpdated

ModuleEnabled

ModuleDisabled

Events Consumed
EntitlementChanged (from subscription service)

9. Caching Strategy
Redis Keys:

config:{tenantId}:{category}:{configKey}

modules:{tenantId}

Cache invalidation triggered by:

ConfigUpdated event

ModuleEnabled/Disabled event

10. Gateway Enforcement
Gateway must:

Cache enabled modules per tenant

Block routes for disabled modules

Invalidate cache when receiving ModuleEnabled/Disabled

11. Observability
Metrics:

Config updates per tenant

Module toggle frequency

Cache hit rate

12. Security
Config update requires permission:

CONFIG_UPDATE

Module toggle requires:

CONFIG_MODULE_MANAGE

All updates generate audit event

LLD-03 Complete
Now SME is officially configurable and modular.

Next:

LLD-04 — Audit Service
(Immutable, append-only, compliance backbone)

After that:

LLD-05 — API Gateway Policies & Route Map

Then we hit:

🚦 BUILD GATE 1: START COPILOT

Proceeding to LLD-04 next.



Reply

Forward
