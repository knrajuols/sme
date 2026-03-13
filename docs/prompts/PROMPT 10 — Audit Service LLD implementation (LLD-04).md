
PROMPT 10 — Audit Service LLD implementation (LLD-04)

Implement audit-service per LLD-04.

Prisma schema: audit_logs, audit_retention_policies, audit_export_jobs.

Consume AuditEventRequested events from RMQ and write audit_logs (append-only).
Optional hash chaining: include previous_hash and row_hash; implement per tenant feature flag.

APIs:
GET /audit/logs (filters + pagination)
GET /audit/logs/:id
POST /audit/export (creates export job, background worker generates CSV and uploads via file-service stub; return file url)
Provide retention policy config endpoints (optional):
PUT /audit/retention

No direct write APIs allowed.

Swagger docs + health.