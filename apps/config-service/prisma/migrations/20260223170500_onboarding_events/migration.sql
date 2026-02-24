-- CreateTable
CREATE TABLE "ModuleEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigMaster" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "configType" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleEntitlement_tenantId_idx" ON "ModuleEntitlement"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleEntitlement_tenantId_moduleKey_key" ON "ModuleEntitlement"("tenantId", "moduleKey");

-- CreateIndex
CREATE INDEX "ConfigMaster_tenantId_idx" ON "ConfigMaster"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigMaster_tenantId_configType_configKey_key" ON "ConfigMaster"("tenantId", "configType", "configKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_key" ON "ProcessedEvent"("eventId");
