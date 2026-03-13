-- DropIndex: single-column actorId index (replaced by compound below)
DROP INDEX IF EXISTS "AuditEvent_actorId_idx";

-- CreateIndex: compound tenantId+actorId for scoped forensic queries
-- WHERE tenantId = ? AND actorId = ? is the standard actor-lookup pattern.
CREATE INDEX "AuditEvent_tenantId_actorId_idx" ON "AuditEvent"("tenantId", "actorId");

-- CreateIndex: compound tenantId+requestedBy for export job history queries
-- WHERE tenantId = ? AND requestedBy = ? (show my export jobs)
CREATE INDEX "AuditExportJob_tenantId_requestedBy_idx" ON "AuditExportJob"("tenantId", "requestedBy");
