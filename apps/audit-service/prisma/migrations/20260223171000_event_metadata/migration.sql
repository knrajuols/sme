-- AlterTable
ALTER TABLE "AuditEvent"
ADD COLUMN "tenantId" VARCHAR(50),
ADD COLUMN "correlationId" VARCHAR(50),
ADD COLUMN "actorType" VARCHAR(32),
ADD COLUMN "moduleKey" VARCHAR(50),
ADD COLUMN "entityType" VARCHAR(100),
ADD COLUMN "sourceService" VARCHAR(100);

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_idx" ON "AuditEvent"("tenantId");
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- Populate legacy values for existing rows
UPDATE "AuditEvent"
SET
  "tenantId" = 'SYSTEM',
  "correlationId" = gen_random_uuid(),
  "actorType" = 'SYSTEM',
  "moduleKey" = 'core',
  "entityType" = 'LEGACY',
  "sourceService" = 'audit-service'
WHERE "tenantId" IS NULL
  AND "correlationId" IS NULL
  AND "actorType" IS NULL
  AND "moduleKey" IS NULL
  AND "entityType" IS NULL
  AND "sourceService" IS NULL;

-- Alter columns to NOT NULL
ALTER TABLE "AuditEvent"
  ALTER COLUMN "tenantId" SET NOT NULL,
  ALTER COLUMN "correlationId" SET NOT NULL,
  ALTER COLUMN "actorType" SET NOT NULL,
  ALTER COLUMN "moduleKey" SET NOT NULL,
  ALTER COLUMN "entityType" SET NOT NULL,
  ALTER COLUMN "sourceService" SET NOT NULL;
