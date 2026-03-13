

Excellent.
Now we complete LLD Pack 1.

This is the final control layer before we allow Copilot to start building.

LLD-05 — API Gateway Policies & Route Map
(SME Enterprise Traffic Control Layer)

This is where:

Authentication is enforced

Tenant isolation is enforced

Module toggles are enforced

Rate limiting happens

Correlation ID is injected

Logging begins

Services are protected from direct access

After this, we hit 🚦 BUILD GATE 1

1. API Gateway Scope
Responsibilities
Single public entry point

JWT validation

Tenant resolution

Role-based route enforcement

Module enablement enforcement

Rate limiting

Correlation ID propagation

Standard response formatting

Request/response logging

Block direct service exposure

Non-Responsibilities
Business validation

Database operations

Event publishing

2. Gateway Architecture Model
Client (Web App)
       ↓
API Gateway
       ↓
Microservices (internal network only)
       ↓
Databases / Broker
Rules:

Microservices must NOT be directly exposed to public internet.

Only Gateway is exposed.

3. Authentication Enforcement
3.1 JWT Validation Flow
On every request:

Extract Authorization: Bearer <token>

Validate:

Signature

Expiry

Not revoked (via IAM cache)

Extract claims:

userId

tenantId

roles

sessionId

Resolve tenant status from cache

If tenant suspended → return 403

4. Tenant Resolution Rules
Rule 1 — Tenant Users
Tenant ID must come from JWT claim.

Any X-Tenant-Id header from client ignored.

Rule 2 — Platform Super Admin
Can pass X-Tenant-Id.

Must be audited.

Must have PLATFORM_ADMIN role.

5. Module Enforcement
Gateway maintains cached module map per tenant:

Redis key:

modules:{tenantId}
On each request:

Determine module from route.

Check module enabled.

If disabled:

Return 403

Message: "Module not enabled for tenant"

Example mapping:

Route Prefix	Module
/attendance	attendance
/fees	fees
/exam	exam
/transport	transport
/library	library
/inventory	inventory
/portal	portal
/website	website
Platform routes (/platform/*) bypass module enforcement.

6. Route Map (Service Routing Table)
Route Prefix	Target Service
/auth	IAM Service
/users	IAM Service
/roles	IAM Service
/platform/tenants	Tenant Service
/tenant	Tenant Service
/config	Config Service
/audit	Audit Service
/students	Student Service
/admissions	Admissions Service
/master	Master Data Service
/attendance	Attendance Service
/academic	Academic Service
/exam	Exam Service
/fees	Fees Service
/hr	HR Service
/communication	Communication Service
/transport	Transport Service
/library	Library Service
/inventory	Inventory Service
/analytics	Analytics Service
/subscription	Subscription Service
/support	Support Service
7. Authorization Enforcement
Gateway performs coarse role enforcement.

Flow:

Map route → required permission(s)

Check role claim

If not allowed → 403

Example:

Route	Required Permission
POST /students	STUDENT_CREATE
POST /fees/reverse	FEE_REVERSE
PUT /exam/publish	RESULT_PUBLISH
PATCH /users	IAM_USER_UPDATE
GET /audit/logs	AUDIT_VIEW
Final authorization also rechecked inside service (defense-in-depth).

8. Correlation ID Policy
Every request must contain:

X-Correlation-Id

If absent:

Gateway generates UUID.

Inject into downstream header.

All services must log:

correlationId

tenantId

userId

9. Rate Limiting
Per Tenant:

2000 requests/minute (configurable)

Per User:

200 requests/minute

Per IP (login endpoint):

10 attempts/minute

Exceed:

HTTP 429 Too Many Requests

10. Request Size Limits
JSON max: 2MB

File upload: Only via File Service

Reject oversized payload at Gateway

11. Response Standardization
Gateway ensures:

All responses match standard envelope

Hide internal stack traces

Convert internal errors to standardized error format

12. Logging & Monitoring
Log at Gateway:

request start time

route

tenantId

userId

response status

latency

correlationId

Do NOT log:

passwords

tokens

PII

13. Security Controls
HTTPS only

CORS policy restricted

WAF ready

Optional IP allowlist for /platform/*

14. Health Endpoints
Gateway:

/health/live

/health/ready

Should check:

IAM connectivity

Tenant cache

Redis availability

15. Failure Handling
If downstream service unavailable:

Return 503

Log error

Include correlationId in response

Circuit breaker recommended for:

IAM

Tenant

Config

16. DevOps Requirements
All services internal network only

Gateway publicly exposed

Secrets stored in secret manager

JWT public keys cached

LLD-05 Complete
🚦 BUILD GATE 1 — START COPILOT
Now you may start interacting with Copilot.

We will build:

Phase 1 — Platform Core Services
API Gateway

IAM Service

Tenant Service

Config Service

Audit Service

Shared library:

response envelope

correlation middleware

JWT validation middleware

error codes

RBAC helper

What You Should Do Now
In C:\projects\SME

We will generate:

Monorepo structure

Microservice folders

Docker setup

Shared package

Base service template

Before I give you the Copilot Prompt Pack:
Final question (very important):

Choose Tech Stack
Option A:

Node.js (NestJS)

PostgreSQL

Redis

RabbitMQ

Option B:

Java (Spring Boot)

PostgreSQL

Redis

Kafka

Option C:

.NET Core

PostgreSQL

Redis

RabbitMQ

Your 31-year instinct + long-term maintainability:
Tell me your choice.

Then I will generate the exact Copilot master prompt for repo scaffolding.

We are now entering build mode.


