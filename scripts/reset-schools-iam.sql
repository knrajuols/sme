-- ============================================================
-- RESET: Delete all school tenants and their school-only users
-- Keeps: platform admin user + all platform-scoped roles/permissions
-- ============================================================

-- 1. Delete all non-platform users from IAM
-- (run against sme_iam database)
DELETE FROM "UserRole"  WHERE "tenantId" != 'platform';
DELETE FROM "User"      WHERE "tenantId" != 'platform';

