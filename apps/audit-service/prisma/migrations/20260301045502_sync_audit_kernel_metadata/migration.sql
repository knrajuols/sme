/*
  Warnings:

  - You are about to drop the column `actor` on the `AuditEvent` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `AuditEvent` table. All the data in the column will be lost.
  - You are about to drop the column `tenantCode` on the `AuditEvent` table. All the data in the column will be lost.
  - You are about to alter the column `action` on the `AuditEvent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - Added the required column `entityId` to the `AuditEvent` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `actorType` on the `AuditEvent` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'SCHEDULED_JOB');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- DropIndex
DROP INDEX "AuditEvent_action_idx";

-- DropIndex
DROP INDEX "AuditEvent_actor_idx";

-- DropIndex
DROP INDEX "AuditEvent_tenantCode_idx";

-- DropIndex
DROP INDEX "AuditEvent_tenantId_idx";

-- AlterTable
ALTER TABLE "AuditEvent" DROP COLUMN "actor",
DROP COLUMN "payload",
DROP COLUMN "tenantCode",
ADD COLUMN     "actorId" VARCHAR(50),
ADD COLUMN     "actorRole" VARCHAR(100),
ADD COLUMN     "afterSnapshot" JSONB,
ADD COLUMN     "beforeSnapshot" JSONB,
ADD COLUMN     "entityId" VARCHAR(50) NOT NULL,
ADD COLUMN     "ipAddress" VARCHAR(45),
ADD COLUMN     "reason" VARCHAR(500),
ADD COLUMN     "rowHash" VARCHAR(64),
ADD COLUMN     "userAgent" VARCHAR(500),
ALTER COLUMN "action" SET DATA TYPE VARCHAR(50),
DROP COLUMN "actorType",
ADD COLUMN     "actorType" "AuditActorType" NOT NULL;

-- CreateTable
CREATE TABLE "AuditRetentionPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" VARCHAR(50) NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 2555,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" VARCHAR(50),
    "updatedBy" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditExportJob" (
    "id" TEXT NOT NULL,
    "tenantId" VARCHAR(50) NOT NULL,
    "requestedBy" VARCHAR(50) NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "filtersJson" JSONB NOT NULL,
    "fileUrl" TEXT,
    "format" VARCHAR(10) NOT NULL DEFAULT 'csv',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMsg" TEXT,

    CONSTRAINT "AuditExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditRetentionPolicy_tenantId_key" ON "AuditRetentionPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "AuditExportJob_tenantId_idx" ON "AuditExportJob"("tenantId");

-- CreateIndex
CREATE INDEX "AuditExportJob_status_idx" ON "AuditExportJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_key" ON "ProcessedEvent"("eventId");

-- CreateIndex
CREATE INDEX "ProcessedEvent_processedAt_idx" ON "ProcessedEvent"("processedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_moduleKey_idx" ON "AuditEvent"("tenantId", "moduleKey");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_idx" ON "AuditEvent"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");
