/*
  Warnings:

  - You are about to alter the column `tenantId` on the `ConfigMaster` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `configType` on the `ConfigMaster` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `configKey` on the `ConfigMaster` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `tenantId` on the `ModuleEntitlement` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `moduleKey` on the `ModuleEntitlement` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `eventType` on the `ProcessedEvent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to drop the `Configuration` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tenantId,configType,configKey,version]` on the table `ConfigMaster` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ConfigMaster_tenantId_configType_configKey_key";

-- AlterTable
ALTER TABLE "ConfigMaster" ADD COLUMN     "createdBy" VARCHAR(50),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "softDelete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedBy" VARCHAR(50),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "configType" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "configKey" SET DATA TYPE VARCHAR(200);

-- AlterTable
ALTER TABLE "ModuleEntitlement" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "disabledBy" VARCHAR(50),
ADD COLUMN     "enabledAt" TIMESTAMP(3),
ADD COLUMN     "enabledBy" VARCHAR(50),
ADD COLUMN     "softDelete" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "moduleKey" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "ProcessedEvent" ALTER COLUMN "eventType" SET DATA TYPE VARCHAR(100);

-- DropTable
DROP TABLE "Configuration";

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "tenantId" VARCHAR(50) NOT NULL,
    "flagKey" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(500),
    "createdBy" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureFlag_tenantId_idx" ON "FeatureFlag"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_tenantId_flagKey_key" ON "FeatureFlag"("tenantId", "flagKey");

-- CreateIndex
CREATE INDEX "ConfigMaster_tenantId_configType_idx" ON "ConfigMaster"("tenantId", "configType");

-- CreateIndex
CREATE INDEX "ConfigMaster_tenantId_isActive_idx" ON "ConfigMaster"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigMaster_tenantId_configType_configKey_version_key" ON "ConfigMaster"("tenantId", "configType", "configKey", "version");

-- CreateIndex
CREATE INDEX "ProcessedEvent_processedAt_idx" ON "ProcessedEvent"("processedAt");
