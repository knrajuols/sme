/*
  Warnings:

  - You are about to alter the column `code` on the `Tenant` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `name` on the `Tenant` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - The `status` column on the `Tenant` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `domain` on the `Tenant` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.

*/
-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "createdBy" VARCHAR(50),
ADD COLUMN     "legalName" VARCHAR(200),
ADD COLUMN     "softDelete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialEndDate" TIMESTAMP(3),
ADD COLUMN     "updatedBy" VARCHAR(50),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "code" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(200),
DROP COLUMN "status",
ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
ALTER COLUMN "domain" SET DATA TYPE VARCHAR(200);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "tenantId" VARCHAR(50) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "routingKey" VARCHAR(200) NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "OutboxEvent_published_createdAt_idx" ON "OutboxEvent"("published", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_tenantId_idx" ON "OutboxEvent"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_key" ON "ProcessedEvent"("eventId");

-- CreateIndex
CREATE INDEX "ProcessedEvent_processedAt_idx" ON "ProcessedEvent"("processedAt");
