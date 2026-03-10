-- Migration: add_school_admin_name_unique_email
-- Adds schoolAdminName (primary contact name) to Tenant table for persistence.
-- Adds UNIQUE constraint to contactEmail to prevent duplicate school registrations.

-- Store the school admin (primary contact) name at registration time
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "schoolAdminName" VARCHAR(200);

-- Enforce one registration per admin email address
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_contactEmail_key" ON "Tenant"("contactEmail");
