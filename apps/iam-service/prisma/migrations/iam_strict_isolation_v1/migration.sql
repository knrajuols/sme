-- iam_strict_isolation_v1: add tenantId to Role (already applied directly)
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "tenantId" VARCHAR(50) NOT NULL DEFAULT 'system';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" VARCHAR(50) NOT NULL DEFAULT 'system';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;