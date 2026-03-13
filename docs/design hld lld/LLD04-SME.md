


Excellent.
Now we build the compliance backbone of SME.

LLD-04 — Audit & Compliance Service
(Enterprise-grade, immutable, legally defensible)

This service is critical because:

Schools deal with student records (sensitive data)

Financial reversals must be traceable

Marks edits must be auditable

User role changes must be recorded

Tenant-level impersonation must be logged

If this is weak, SME is not enterprise-grade.

1. Audit Service Scope
Responsibilities
Store immutable audit records

Accept audit event requests from other services

Provide search/filter APIs

Provide compliance exports

Enforce append-only model

Prevent modification/deletion of audit records

Store before/after snapshots (where applicable)

Support long-term retention

Non-Responsibilities
Business validation

Event publishing except audit confirmation

Role enforcement (IAM does that)

2. Design Principles
Append-only storage

No UPDATE allowed

No DELETE allowed

Only soft retention policies (never silent deletion)

All audit entries tied to:

tenant_id

user_id (or SYSTEM)

correlation_id

All events versioned

3. Data Model
All tables include:

id (UUID)

tenant_id

created_at

is_deleted = false (never set true unless retention policy applied)

version (for schema evolution)

3.1 audit_logs (Primary Table)
Field	Type	Notes
id	UUID	Primary key
tenant_id	UUID	Mandatory
correlation_id	UUID	Propagated from gateway
actor_type	enum	USER / SYSTEM
actor_id	UUID	Nullable if SYSTEM
actor_role	varchar	e.g., ADMIN
module_key	varchar	fees / exam / student
entity_type	varchar	Student / FeeReceipt
entity_id	UUID	Business entity reference
action	varchar	CREATE / UPDATE / DELETE / REVERSE / PUBLISH
reason	varchar	Optional reason
before_snapshot	jsonb	Nullable
after_snapshot	jsonb	Nullable
source_service	varchar	Which service emitted
ip_address	varchar	Optional
user_agent	varchar	Optional
Indexes:

(tenant_id, created_at)

(tenant_id, module_key)

(tenant_id, entity_type, entity_id)

(correlation_id)

3.2 audit_retention_policies
Field	Type
id	UUID
tenant_id	UUID
retention_days	integer
is_active	boolean
3.3 audit_export_jobs
Field	Type
id	UUID
tenant_id	UUID
requested_by	UUID
status	enum (PENDING, COMPLETED, FAILED)
filters_json	jsonb
file_url	varchar
created_at	datetime
completed_at	datetime
4. Event Consumption
Audit service subscribes to:

AuditEventRequested
Payload already defined in HLD:

{
  "module": "fees",
  "entityType": "FeeReceipt",
  "entityId": "uuid",
  "action": "REVERSE",
  "before": { },
  "after": { },
  "reason": "Duplicate payment"
}
5. Audit Write Flow
Business service completes transaction.

Writes outbox record.

Outbox publisher emits AuditEventRequested.

Audit service consumes event.

Validates payload.

Writes new row in audit_logs.

Emits AuditEventRecorded.

If failure:

Retry mechanism.

Dead-letter queue if repeated failure.

6. APIs
All APIs are tenant-scoped.

6.1 Search Audit Logs
GET /audit/logs

Filters:

module_key

entity_type

entity_id

actor_id

action

date range

correlation_id

Pagination required.

6.2 Get Audit Record by ID
GET /audit/logs/{auditId}

6.3 Export Audit Logs
POST /audit/export

Input:

{
  "fromDate": "2026-01-01",
  "toDate": "2026-02-01",
  "moduleKey": "fees",
  "format": "csv|pdf"
}
Flow:

Create export job.

Background process generates file.

Upload to File Service.

Update audit_export_jobs.

Return file URL.

7. Business Rules
No audit log can be modified after insertion.

Snapshot size limit (configurable).

If snapshot exceeds threshold → store truncated + hash.

All financial reversals must include reason.

Marks modification after publish must include reason.

8. Security Requirements
Only users with permission AUDIT_VIEW can view.

Only AUDIT_EXPORT can export.

No service except message broker can write audit.

No direct insert API allowed.

9. Retention Policy
Default:

Retain 7 years (configurable per tenant)

Retention execution:

Scheduled job marks old entries as archived (never delete silently).

Optional move to cold storage.

10. Observability
Metrics:

Audit events per minute

Failed audit writes

Export job durations

Queue backlog

Health:

/health/live

/health/ready

11. Tamper Protection
Recommended:

Store hash of audit row.

Optional chain hashing (blockchain-like chaining):

previous_hash field

Ensures tamper detection

Enterprise Option:

Enable hash chaining per tenant if required.

12. Correlation ID Enforcement
Every audit record must include:

correlation_id

source_service

This allows tracing across microservices.

LLD-04 Complete
Audit backbone is now enterprise-grade.

Next:

LLD-05 — API Gateway Policies & Route Map
This is the final piece before:

🚦 BUILD GATE 1: START COPILOT

Proceeding to LLD-05 now.



