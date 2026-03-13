-- Fix IAM schema: add missing columns that the Prisma schema expects
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "tenantId" VARCHAR(50) NOT NULL DEFAULT 'system';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" VARCHAR(50) NOT NULL DEFAULT 'system';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'Role' AND column_name = 'tenantId';
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'User' AND column_name IN ('tenantId', 'passwordHash');
