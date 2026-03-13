Perfect — continuing with the HLD Appendices in an enterprise + Copilot-friendly way.

HLD Appendix A — Event Catalog (Full List + Payload Fields)
A.1 Event Envelope Standard (mandatory for all events)
Every event published to the broker must follow a standard envelope:

{
  "eventId": "uuid",
  "eventType": "StudentCreated",
  "eventVersion": "1.0",
  "tenantId": "uuid",
  "occurredAt": "2026-02-23T12:34:56Z",
  "producer": {
    "service": "student-service",
    "instanceId": "pod-123"
  },
  "correlationId": "uuid",
  "actor": {
    "actorType": "USER|SYSTEM",
    "actorId": "uuid",
    "role": "Teacher|Admin|SystemJob",
    "ip": "x.x.x.x"
  },
  "payload": { }
}
Rules
tenantId is mandatory.

correlationId must be propagated from API Gateway to services and then into events.

eventVersion is mandatory for forward compatibility.

actor is mandatory for any event triggered by a user action; for scheduled jobs use actorType=SYSTEM.

A.2 Core Platform Events
TenantCreated (tenant-service → many consumers)
Payload

{
  "tenant": {
    "tenantId": "uuid",
    "schoolName": "string",
    "status": "Trial|Active|Suspended",
    "createdAt": "datetime"
  },
  "adminUser": {
    "userId": "uuid",
    "email": "string"
  }
}
Consumers: config-service, subscription-service, audit-service

TenantStatusChanged
Payload

{
  "tenantId": "uuid",
  "oldStatus": "Trial|Active|Suspended",
  "newStatus": "Trial|Active|Suspended",
  "reason": "string"
}
Consumers: api-gateway policy cache, subscription-service, audit-service

ModuleEnabled / ModuleDisabled (config-service)
Payload

{
  "moduleKey": "fees|attendance|exam|hr|transport|library|inventory|portal|website",
  "effectiveFrom": "datetime",
  "reason": "string"
}
Consumers: api-gateway (route blocking), ui-config cache, audit-service

ConfigUpdated (config-service)
Payload

{
  "configKey": "grading_rules|fee_rules|academic_year|templates|workflow_rules",
  "oldVersion": 12,
  "newVersion": 13,
  "changeSummary": "string"
}
Consumers: all services with cached config + analytics + audit

AuditEventRequested (any service → audit-service)
Payload

{
  "module": "fees|attendance|exam|student|iam",
  "entityType": "Student|FeeReceipt|AttendanceRecord|User",
  "entityId": "uuid",
  "action": "CREATE|UPDATE|DELETE|PUBLISH|REVERSE|TRANSFER",
  "before": { },
  "after": { },
  "reason": "string"
}
Consumers: audit-service only

A.3 Student/Admissions Events
AdmissionInquiryCreated (admissions-service)
Payload

{
  "inquiryId": "uuid",
  "studentName": "string",
  "guardianName": "string",
  "contactPhone": "string",
  "requestedClass": "string",
  "source": "walkin|web|referral|campaign"
}
Consumers: analytics-service, communication-service (optional)

AdmissionApproved / AdmissionRejected
Payload

{
  "inquiryId": "uuid",
  "decisionBy": "userId",
  "decisionAt": "datetime",
  "remarks": "string"
}
AdmissionConvertedToStudent
Payload

{
  "inquiryId": "uuid",
  "studentId": "uuid",
  "admissionNumber": "string",
  "classId": "uuid",
  "sectionId": "uuid"
}
Consumers: attendance-service (optional roster), fees-service (generate fee plan), communication-service

StudentCreated (student-service)
Payload

{
  "studentId": "uuid",
  "admissionNumber": "string",
  "fullName": "string",
  "classId": "uuid",
  "sectionId": "uuid",
  "status": "Active",
  "guardians": [
    { "guardianId": "uuid", "relation": "Father|Mother|Guardian", "phone": "string" }
  ]
}
Consumers: attendance-service, fees-service, transport-service, exam-service, analytics-service, communication-service

StudentUpdated
Payload

{
  "studentId": "uuid",
  "changedFields": ["address","phone","classId"],
  "oldValues": { },
  "newValues": { }
}
StudentPromoted
Payload

{
  "studentId": "uuid",
  "fromClassId": "uuid",
  "toClassId": "uuid",
  "effectiveFromAcademicYear": "uuid"
}
StudentTransferred / StudentArchived
Payload

{
  "studentId": "uuid",
  "status": "Transferred|Archived|Alumni",
  "effectiveDate": "datetime",
  "reason": "string"
}
A.4 Attendance Events
AttendanceMarked (attendance-service)
Payload

{
  "attendanceId": "uuid",
  "date": "YYYY-MM-DD",
  "scope": "daily|period",
  "classId": "uuid",
  "sectionId": "uuid",
  "markedBy": "userId",
  "summary": { "present": 30, "absent": 5, "late": 2 },
  "records": [
    { "studentId": "uuid", "status": "P|A|L", "reason": "string(optional)" }
  ]
}
Consumers: analytics-service, communication-service (absence alerts)

AttendanceEdited
Payload

{
  "attendanceId": "uuid",
  "editedBy": "userId",
  "editReason": "string",
  "oldSnapshot": { },
  "newSnapshot": { }
}
Consumers: audit-service, analytics-service

A.5 Exams / Results Events
ExamCreated (exam-service)
Payload

{
  "examId": "uuid",
  "termId": "uuid",
  "name": "string",
  "classes": ["classId"],
  "schedule": [{ "subjectId":"uuid","date":"YYYY-MM-DD" }]
}
MarksEntered
Payload

{
  "examId": "uuid",
  "classId": "uuid",
  "sectionId": "uuid",
  "subjectId": "uuid",
  "enteredBy": "userId",
  "records": [{ "studentId":"uuid","marks": 78 }]
}
ResultPublished
Payload

{
  "examId": "uuid",
  "termId": "uuid",
  "publishedBy": "userId",
  "publishedAt": "datetime",
  "visibleToParents": true
}
Consumers: communication-service, analytics-service

A.6 Fees Events
InvoiceGenerated (fees-service)
Payload

{
  "invoiceId": "uuid",
  "studentId": "uuid",
  "academicYearId": "uuid",
  "amount": 25000,
  "dueDate": "YYYY-MM-DD",
  "lineItems": [{ "feeHeadId":"uuid","amount": 5000 }]
}
FeePaid
Payload

{
  "paymentId": "uuid",
  "invoiceId": "uuid",
  "studentId": "uuid",
  "amountPaid": 5000,
  "paidAt": "datetime",
  "mode": "cash|card|upi|netbanking|gateway",
  "receiptNo": "string"
}
Consumers: analytics-service, communication-service (receipt), audit-service

FeeOverdue
Payload

{
  "studentId": "uuid",
  "invoiceId": "uuid",
  "dueDate": "YYYY-MM-DD",
  "overdueDays": 15,
  "outstandingAmount": 12000
}
FeeRefunded / FeeReversed
Payload

{
  "refundId": "uuid",
  "paymentId": "uuid",
  "amount": 2000,
  "reason": "string"
}
A.7 HR Events
StaffCreated
Payload

{
  "staffId": "uuid",
  "employeeCode": "string",
  "departmentId": "uuid",
  "designationId": "uuid",
  "joiningDate": "YYYY-MM-DD"
}
LeaveApproved
Payload

{
  "leaveId": "uuid",
  "staffId": "uuid",
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "approvedBy": "userId"
}
PayrollProcessed
Payload

{
  "payrollRunId": "uuid",
  "month": "YYYY-MM",
  "processedAt": "datetime",
  "count": 120
}
A.8 Communication/Notification Events
CircularPublished (communication-service)
Payload

{
  "circularId": "uuid",
  "title": "string",
  "target": { "roles": ["Parent","Teacher"], "classIds": ["uuid"] },
  "publishedAt": "datetime"
}
NotificationRequested (communication-service → notification-gateway)
Payload

{
  "notificationId": "uuid",
  "channel": "sms|email|whatsapp",
  "templateKey": "fee_overdue|absence_alert|result_published",
  "recipients": [{ "to":"string","name":"string","entityId":"uuid" }],
  "variables": { "studentName":"", "amount":"", "link":"" },
  "priority": "normal|high|emergency"
}
NotificationDelivered / NotificationFailed
Payload

{
  "notificationId": "uuid",
  "provider": "string",
  "deliveredAt": "datetime",
  "failureReason": "string(optional)"
}
HLD Appendix B — API Contract Standards (Copilot-ready)
B.1 Mandatory Headers
All client → gateway requests must include:

Authorization: Bearer <JWT>

X-Correlation-Id: <uuid> (generated by client; if missing gateway generates)

X-Tenant-Id: <uuid> (optional if token already contains tenantId; required for platform super-admin flows)

Gateway behavior

Adds X-Tenant-Id downstream if resolved from token.

Adds X-Correlation-Id always.

B.2 Tenant Context Rules
For tenant users, tenantId must come from JWT claim.

X-Tenant-Id header from client is ignored for tenant users (prevents spoofing).

Only platform super-admin can pass X-Tenant-Id explicitly, and it is always audited.

B.3 Standard Response Envelope
All services must return:

{
  "status": "success|fail",
  "message": "string",
  "data": {},
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "name", "issue": "required" }]
  }
}
error is present only when status=fail.

B.4 HTTP Status Codes
200 OK: successful query

201 Created: resource created

204 No Content: successful delete/void

400 Bad Request: validation errors

401 Unauthorized: invalid/expired token

403 Forbidden: tenant mismatch / permission denied

404 Not Found: resource missing

409 Conflict: duplicates, version conflicts

422 Unprocessable Entity: business rule violation (optional)

500 Internal Server Error: unhandled

B.5 Pagination Standard
For list endpoints:

Request

?page=1&size=25

?sort=createdAt:desc

?q=freeText (optional)

?filter=key:value,key2:value2 (optional)

Response

{
  "status": "success",
  "message": "ok",
  "data": {
    "items": [],
    "page": 1,
    "size": 25,
    "totalItems": 532,
    "totalPages": 22
  }
}
B.6 Idempotency for Write APIs
For create/payment/critical actions:

Idempotency-Key: <uuid>

Service must store request hash + result for a time window (e.g., 24h) to avoid duplicates.

B.7 Concurrency Control (Optimistic Locking)
For update APIs:

Include version field in entity.

Client sends If-Match: <version> (or in body).

If mismatch → 409 Conflict.

B.8 Validation Error Format (strict)
{
  "status": "fail",
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "admissionNumber", "issue": "must be unique" },
      { "field": "guardianPhone", "issue": "invalid format" }
    ]
  }
}
B.9 Standard Query Filters (recommended)
createdFrom, createdTo

status

classId, sectionId

studentId, staffId

B.10 Security Controls at Gateway
Rate limits per tenant (configurable):

e.g., 200 req/min per user

2000 req/min per tenant

Payload size limits (e.g., 2MB JSON, uploads only via file-service)

IP allowlisting optional for admin consoles (tenant-configurable later)

HLD Appendix C — Service-to-Service Matrix (Who calls whom + Why)
Legend:

REST = synchronous

EVENT = async event consumption

C.1 Core Platform Calls
API Gateway → All Services (REST) : routing + auth

All Services → Config Service (REST) : fetch configuration snapshots (cached)

All Services → Audit Service (EVENT) : audit logging

Communication Service → Notification Gateway (EVENT) : send messages

Any Service → File Service (REST) : get signed URL / store metadata

C.2 Domain Calls (Typical)
Admissions Flow
Admissions → Master Data (REST) : check class capacity/rules

Admissions → Student (REST) : create student upon conversion

Admissions → Communication (EVENT/REST) : notify admission status (optional)

Student Registration Cascade
Student publishes StudentCreated (EVENT) →

Attendance consumes → roster cache / initialization

Fees consumes → initial invoice generation (config-driven)

Transport consumes → eligibility checks (optional)

Exam consumes → eligibility for exam setup

Analytics consumes → dashboards update

Attendance Alerts
Attendance publishes AttendanceMarked (EVENT) →

Communication consumes → absence alerts

Analytics consumes → risk scoring

Fees Reminders
Fees publishes FeeOverdue (EVENT) →

Communication consumes → reminder generation → NotificationRequested

Results Publish
Exam publishes ResultPublished (EVENT) →

Communication consumes → notify parents/students

Analytics consumes → performance dashboards

HR Payroll
HR consumes Attendance events (EVENT) (optional) →

payroll attendance-based salary rules

HR publishes PayslipGenerated (EVENT) →

Communication consumes → send payslip (staff portal)

HLD Appendix D — Data Ownership Map (Entity → Service of Record)
This eliminates ambiguity for schema and API ownership.

D.1 Platform Entities
Tenant → Tenant Service

Subscription Plan / Entitlements → Subscription Service

Module Enablement → Configuration Service

Users / Roles / Permissions → IAM Service

Audit Log → Audit Service

Files Metadata → File Service

Support Tickets → Support Service

D.2 School Domain Entities
Student Profile → Student Service

Guardians → Student Service

Admissions Inquiry/Application → Admissions Service

Classes/Sections/Subjects/Houses → Master Data Service

Timetable / Teacher allocations → Academic Service

Attendance records → Attendance Service

Exams/Marks/Results/ReportCards → Examination Service

Fee Plans/Invoices/Payments/Receipts/Ledger → Fees Service

Staff Profile/Leave/Payroll → HR Service

Circulars / Messages / ReadReceipts → Communication Service

Notification delivery logs → Notification Gateway

Transport Routes/Stops/Assignments → Transport Service

Library Catalog/Issue/Return → Library Service

Inventory/Assets/Stock movements → Inventory Service

Dashboards/Risk scores/Reports → Analytics Service

D.3 “Read Models” (Derived Data)
Analytics DB stores denormalized aggregates derived from events.

It is NOT the source of truth for student/fees/exams.

What we do next (no delay)
Now that HLD is complete with appendices, the next step is:

✅ LLD Phase 1 — Platform Core Pack
We will produce (in this order):

IAM LLD (tables + APIs + permission model + token claims)

Tenant LLD (tenant onboarding + lifecycle + super-admin controls)

Configuration LLD (module toggles + config versioning + caching strategy)

Audit LLD (immutable append-only model + query APIs + retention policy)

API Gateway LLD (routes, policies, rate limits, tenant resolution rules)

Then we go module-by-module: Student → Admissions → Master Data → Attendance → Academic → Exams → Fees → HR → Communication → etc.

If you want me to proceed immediately in the next message without questions, I’ll start with IAM LLD (because everything depends on it).

