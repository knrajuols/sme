-- AlterTable
ALTER TABLE "AuditEvent"
ADD COLUMN "eventType" TEXT,
ADD COLUMN "correlationId" TEXT,
ADD COLUMN "actorType" TEXT,
ADD COLUMN "actorId" TEXT,
ADD COLUMN "actorRole" TEXT,
ADD COLUMN "entity" TEXT,
ADD COLUMN "entityId" TEXT,
ADD COLUMN "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_idx" ON "AuditEvent"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");
