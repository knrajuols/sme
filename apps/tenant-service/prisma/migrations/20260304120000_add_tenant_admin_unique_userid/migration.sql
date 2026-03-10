-- AddUniqueConstraint: TenantAdmin.tenantId + userId
-- One user can hold only one admin record per tenant (cross-service integrity guard).
CREATE UNIQUE INDEX "TenantAdmin_tenantId_userId_key" ON "TenantAdmin"("tenantId", "userId");
