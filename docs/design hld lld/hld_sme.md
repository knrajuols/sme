Below is the High-Level Design (HLD) for SME – School Management Excellence, written to be detailed, granular, and covering every aspect of the SRS. This HLD is intentionally “implementation-ready” while still staying at high-level architecture (LLD will later define exact schemas, APIs, methods, validations, and data contracts).

SME – School Management Excellence
High-Level Design (HLD) – Microservices Multi-Tenant SaaS
Version: 1.0
Phase: Web Application (Mobile-ready APIs)
Architecture: Microservices + API Gateway + Event-Driven Integration
Tenancy: Multi-tenant, row-level isolation (tenant_id) per service DB
Inter-service: REST (sync) + Message Broker (async)
Primary Design Goal: Enterprise-grade reliability, configurability, auditability, scalability

1. ARCHITECTURE PRINCIPLES
Service Ownership

Each microservice owns its data, business rules, and APIs.

No service is allowed to query another service’s database.

Tenant Isolation

Every data record must contain tenant_id.

All reads/writes must enforce tenant_id filter.

Cross-tenant access must be impossible by design.

Config-First Platform

Most “differences between schools” must be solved by configuration, not custom code.

Audit-First Platform

Any sensitive write operation must produce an immutable audit event.

Eventual Consistency Where Appropriate

Core workflows use REST for immediate UX.

Cross-domain actions propagate via events.

Security by Default

Zero trust internally: all service-to-service calls authenticated.

RBAC/ABAC policies enforced at Gateway and within services.

2. SYSTEM CONTEXT & USERS
2.1 Personas (Primary)
Platform Super Admin

School Admin

Principal / Management

Academic Coordinator

Teacher

Accounts Officer

HR Officer

Admissions Officer

Transport Admin

Librarian

Inventory Manager

Parent/Student (Web portal Phase 1 optional, Mobile Phase 2)

2.2 Primary Platforms
Web Admin Console (platform)

Web School Console (tenant)

Web Teacher Console

Web Parent/Student Portal (optional Phase 1, enabled per tenant)

3. DEPLOYMENT TOPOLOGY
3.1 High-Level Components
Web Frontend (SPA / SSR optional)

API Gateway

Microservices

Message Broker

Databases (per service)

Object Storage (documents/photos)

Cache

Search (optional)

Observability Stack (logs, metrics, tracing)

CI/CD Pipeline

3.2 Environments
Dev

Staging

Production

4. MICROSERVICES CATALOG (BOUNDARIES + DB OWNERSHIP)
Each service has:

Service API

Service DB

Event publisher/consumer roles (as needed)

4.1 Core Platform Services
A) API Gateway Service
Purpose: Single entry point for all client calls
Responsibilities:

Routing to services

Authentication validation (JWT)

Tenant resolution

Rate limiting

Request logging

Response shaping (standard API envelope)

Correlation ID injection

DB: None
Cache: Optional for public site pages (tenant front page)

B) Identity & Access Service (IAM)
Responsibilities:

User authentication (email/username/password; future OTP/SSO)

Password policies & account lockouts

Role management (tenant-specific)

Permission policies (RBAC/ABAC)

JWT issuance & refresh tokens

Session management policies

DB: IAM DB
Events Published:

UserCreated

UserRoleChanged

UserSuspended

C) Tenant Management Service
Responsibilities:

Create tenant (school)

Tenant lifecycle (Trial/Active/Suspended)

Tenant metadata (school name, contact, addresses, branches)

Tenant plan assignment reference

Tenant admins mapping

Domain mapping future-ready

DB: Tenant DB
Events Published:

TenantCreated

TenantActivated

TenantSuspended

TenantPlanChanged

D) Configuration Service
Responsibilities:

Module enable/disable per tenant

Tenant configuration store:

Academic year rules

Grading rules

Fee templates

Timetable constraints

Workflow approvals

Templates (report card/certificates)

Notification templates

Configuration versioning

Rollback support

DB: Config DB
Events Published:

ConfigUpdated

ModuleEnabled

ModuleDisabled

E) Audit & Compliance Service
Responsibilities:

Immutable audit records for sensitive actions

Who did what, when, from where, before/after

Search/filter by tenant, user, module, entity

Compliance exports

DB: Audit DB (append-only design)
Events Consumed:

AuditEventRequested (from all services)
Events Published:

AuditEventRecorded

F) File/Document Service
Responsibilities:

Store and retrieve documents and media

Validate type/size

Provide signed URLs

Tenant-based bucket/prefix separation

Storage: Object store (S3/Azure Blob/etc.)
DB: File metadata DB
Events Published:

FileUploaded

FileDeleted

4.2 School Domain Services
G) Admissions Service
Responsibilities:

Inquiry capture

Application processing

Status workflow: New → Reviewed → Approved/Rejected

Seat/capacity check (via Academic/Master Data service)

Convert to student (via Student Service)

Offer letter generation (template from Config)

DB: Admissions DB
Events Published:

AdmissionInquiryCreated

AdmissionApproved

AdmissionRejected

AdmissionConvertedToStudent

H) Student Service
Responsibilities:

Student master profile

Guardian mapping

Enrollment details (class/section)

Student lifecycle: promote, transfer, archive, alumni

ID generation policy per tenant

Student documents linking (File service)

DB: Student DB
Events Published:

StudentCreated

StudentUpdated

StudentPromoted

StudentTransferred

StudentArchived

I) Master Data / Organization Service
Responsibilities:

Classes/sections

Subjects

Departments/designations

Houses

Academic years

Campuses/branches

Room inventory (for timetable)

Fee heads master (or shared reference with Fees service)

DB: Master DB
Events Published:

ClassCreated

SubjectUpdated

DepartmentUpdated

J) Academic Operations Service
Responsibilities:

Timetable creation and conflict rules

Teacher-subject-class mapping

Lesson plans, homework, notes (Phase 1 optional)

Academic calendar / events (or separate Event service)

DB: Academic DB
Events Published:

TimetablePublished

HomeworkAssigned (optional)

K) Attendance Service
Responsibilities:

Student attendance daily/period-wise

Staff attendance (optionally here or HR)

Late mark rules (from Config)

Edit requires reason (audit)

Attendance reports

DB: Attendance DB
Events Published:

AttendanceMarked

AttendanceEdited
Events Consumed:

StudentCreated (optional for cache/denormalized roster)

L) Examination & Report Service
Responsibilities:

Term/exam setup

Marks entry validation

Grade calculation rules (from Config)

Moderation rules (from Config)

Report card generation (template + data)

Publish workflow

DB: Exam DB
Events Published:

ExamCreated

MarksEntered

ResultPublished

ReportCardGenerated

M) Fees & Billing Service
Responsibilities:

Fee structures, installments

Concessions/scholarships

Fine rules

Receipts, refunds, reversals

Outstanding dues

Ledger entries (internal ledger)

Payment integration hooks

DB: Fees DB
Events Published:

FeePlanCreated

InvoiceGenerated

FeePaid

FeeRefunded

FeeOverdue

N) HR & Payroll Service
Responsibilities:

Staff profiles, contracts

Leave rules

Payroll structures

Payslip generation

Attendance integration (consume attendance events if needed)

Separation workflow

DB: HR DB
Events Published:

StaffCreated

LeaveApproved

PayrollProcessed

PayslipGenerated

O) Communication Service
Responsibilities:

Circulars, announcements

Role-based targeting

Read receipts

Two-way messaging (optional)

Message templates

DB: Communication DB
Events Published:

CircularPublished

MessageSent
Events Consumed:

FeeOverdue → trigger reminders

AttendanceMarked (absence) → trigger alerts

ResultPublished → trigger notifications

P) Notification Gateway Service
Responsibilities:

Channel adapters: SMS / Email / WhatsApp

Provider abstraction (pluggable)

Delivery status tracking

Retry policy and dead-lettering

DB: Notification DB
Events Consumed:

NotificationRequested
Events Published:

NotificationDelivered

NotificationFailed

Q) Transport Service
Responsibilities:

Routes, stops, vehicles

Driver/attendant profiles

Student allocation

Transport attendance

Integration-ready GPS hooks

DB: Transport DB
Events Published:

StudentTransportAssigned

TransportAttendanceMarked

R) Library Service (Optional Module)
Responsibilities:

Catalog

Issue/return

Fine calculation

Member mapping

DB: Library DB
Events Published:

BookIssued

BookReturned

S) Inventory & Asset Service (Optional Module)
Responsibilities:

Inventory items & stock movements

Asset registry

Maintenance schedules

Vendor records (light)

DB: Inventory DB
Events Published:

StockUpdated

AssetMaintenanceDue

T) Analytics & Insights Service
Responsibilities:

Tenant dashboards

Risk indicators:

Low attendance risk

Fee default risk

Performance decline risk

Scheduled jobs for KPIs

Export services (CSV/PDF)

DB: Analytics DB (read model)
Events Consumed: from multiple services

AttendanceMarked

FeePaid

FeeOverdue

ResultPublished

StudentCreated/Archived
Design: Event-driven denormalized read models (CQRS-style)

U) Subscription & Monetization Service
Responsibilities:

Plans, entitlements (modules enabled by plan)

Billing cycles

Usage tracking (per student, per module)

Invoices to schools

Trial handling & grace periods

Enforcement signals to Config service

DB: Subscription DB
Events Published:

EntitlementChanged

PlanExpired

UsageLimitExceeded

V) Support & Ticketing Service (Ops)
Responsibilities:

Tenant support tickets

SLA tracking

Internal notes & resolution logs

Attachments support (File service)

DB: Support DB
Events Published:

TicketCreated

TicketResolved

5. DATA ISOLATION MODEL (TENANT ENFORCEMENT)
5.1 Tenant Context Propagation
API Gateway resolves tenant_id via:

tenant subdomain (future)

tenant header (X-Tenant-ID) in controlled admin context

user’s token claim (preferred)

5.2 Enforcement Rules
Every service must:

validate tenant context

include tenant_id in all primary tables

enforce tenant filter in every query

If tenant mismatch → return 403 Forbidden

5.3 Indexing Rules
All tenant-scoped tables must have composite indexes:

(tenant_id, <primary business key>)

(tenant_id, created_at) for reporting

6. COMMUNICATION PATTERNS
6.1 Synchronous (REST)
Used for:

UI-driven CRUD operations

Immediate validations

Read queries for user screens

Examples:

Create student

Update fee plan

Marks entry submission

6.2 Asynchronous (Events)
Used for:

Notifications

Analytics read models

Cross-service reactions (fees overdue → notify)

Audit recording

Broker Topics / Queues (illustrative)
tenant.events

student.events

attendance.events

fees.events

exam.events

notification.requests

audit.requests

6.3 Guaranteed Delivery Pattern (Enterprise)
Outbox Pattern

When a service writes business data, it also writes an “outbox” row in same DB transaction.

A background worker publishes outbox events to broker.

Prevents “DB updated but event lost”.

Inbox Pattern (optional)

Consumer keeps processed event IDs to prevent duplicates.

7. API GATEWAY DESIGN
7.1 Standard Request/Response Envelope
All APIs must return:

{
  "status": "success|fail",
  "message": "Human readable message",
  "data": {},
  "errorCode": "OPTIONAL"
}
7.2 Standard Error Codes
AUTH_INVALID_TOKEN

AUTH_FORBIDDEN

TENANT_NOT_FOUND

TENANT_SUSPENDED

VALIDATION_ERROR

RESOURCE_NOT_FOUND

CONFLICT_DUPLICATE

INTERNAL_ERROR

7.3 Security
JWT validated at Gateway

Rate limiting per tenant + IP

WAF rules (optional)

Request size limits (upload via File service only)

8. SECURITY ARCHITECTURE (NFR COVERAGE)
8.1 Authentication
JWT access token short-lived

Refresh token stored securely

Password hashed (bcrypt/argon2)

8.2 Authorization
RBAC: Role → permissions

ABAC: attributes (department, campus, class teacher, etc.)

Permission checks at:

Gateway (coarse)

Service (final authority)

8.3 Audit
All sensitive actions emit AuditEventRequested
Examples:

Fee reversal

Attendance edit

Marks edit after publish

User role changes

Student transfer

8.4 Data Security
TLS everywhere

Encryption at rest for DB and Object storage

PII masking in logs

9. OBSERVABILITY ARCHITECTURE
9.1 Logging
JSON structured logs

Correlation ID propagated from Gateway to all services

No PII in logs (or masked)

9.2 Metrics
Request count, latency, error rates

DB query times

Queue backlog metrics

Tenant-level usage metrics

9.3 Tracing
Distributed tracing across REST + events (OpenTelemetry ready)

9.4 Health Checks
Each service exposes:

/health/live

/health/ready

10. CACHING STRATEGY
Redis cache for:

frequently accessed master data (per tenant)

configuration snapshots (versioned)

token blacklists (if needed)

Cache invalidation via events:

ConfigUpdated clears relevant caches

11. SEARCH STRATEGY (OPTIONAL IN PHASE 1)
If needed:

Search index for:

Students

Staff

Tickets

Library catalog

Can be added later without breaking services.

12. MODULE TOGGLE DESIGN (CORE FOR SME)
12.1 Source of Truth
Configuration Service stores:

enabled modules

entitlements from Subscription Service

tenant overrides

12.2 Enforcement
UI hides disabled modules

API Gateway blocks routes for disabled modules

Each service checks module enabled flag (defensive check)

13. KEY BUSINESS WORKFLOWS (END-TO-END FLOWS)
13.1 Admission → Student Creation Flow
Admissions creates inquiry

Admissions updates status

On approval, Admissions calls Student Service to create student

Student Service emits StudentCreated

Notifications sent (optional)

13.2 Attendance Marking Flow
Teacher marks attendance (Attendance Service)

Attendance emits AttendanceMarked

Analytics updates dashboards

Notification service triggers absentees message (configurable)

13.3 Exam → Results Publish Flow
Exam Service creates exams

Teacher enters marks

Exam calculates grades

Admin publishes result

Exam emits ResultPublished

Notifications + analytics updates

13.4 Fees Collection Flow
Fees generates invoices

Payment recorded

Fees emits FeePaid

Ledger updated

Notification sent receipt

Analytics updated

13.5 Overdue Fee Reminder Flow
Fees scheduled job detects overdue

Fees emits FeeOverdue

Communication triggers reminder

Notification gateway sends SMS/email/WhatsApp

14. DATABASE & STORAGE ARCHITECTURE
14.1 DB Per Service
Each microservice uses its own DB instance or schema boundary.

Standard fields recommended:

id (UUID)

tenant_id

created_at

updated_at

created_by

updated_by

is_deleted (soft delete)

14.2 Object Storage
Student documents

Staff documents

Certificates

Website images

Attachments

15. DEPLOYMENT & DEVOPS
15.1 Containerization
Docker for each service

Versioning per service

15.2 Orchestration
Kubernetes compatible design

Auto-scaling policies

15.3 CI/CD
Build → unit tests → security scan → deploy to staging → smoke tests → prod

15.4 Config Management
Environment-based secrets

Central secrets manager

16. COMPLIANCE & GOVERNANCE
Data retention policies per tenant

Backup policies

Audit retention

Admin impersonation only with explicit audit trail

17. OPEN CHOICES (WE MUST LOCK BEFORE LLD)
To proceed cleanly, we will lock these in the next step (I’ll choose defaults if you don’t want debate):

Tech stack choice (Node/Java/.NET, DB, broker)

Message broker choice (RabbitMQ vs Kafka)

Multi-campus design: tenant → campuses (enabled)

Parent/student portal Phase 1: yes/no

Public website builder: static pages via CMS-like config (recommended)

18. DELIVERABLE OUTPUT OF HLD (WHAT YOU CAN FEED TO COPILOT LATER)
This HLD enables us to produce next:

✅ Service list + boundaries
✅ DB-per-service schema scope
✅ Event catalog
✅ API gateway policies
✅ Tenant isolation standard
✅ Observability standard
✅ Deployment topology

NEXT STEP (After HLD)
LLD Pack 1: “Platform Core”
We will produce:

Exact tables for Tenant, Config, IAM, Audit

Exact APIs (endpoints, request/response models)

Exact events payload structure

Config versioning model

Module toggles enforcement model

Then we will move module-by-module.

If you want, I can continue immediately by adding HLD Appendices (very useful for Copilot coding):

Event Catalog (full list, payload fields)

API Contract Standards (headers, tenant context, pagination, filtering, error model)

Service-to-Service Matrix (who calls whom + why)

Data Ownership Map (entity ownership per service)

I’ll proceed with these appendices next (they complete the HLD in enterprise style).

