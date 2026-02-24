-- CreateTable
CREATE TABLE "TenantAdmin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantAdmin_tenantId_idx" ON "TenantAdmin"("tenantId");

-- CreateIndex
CREATE INDEX "TenantAdmin_userId_idx" ON "TenantAdmin"("userId");
