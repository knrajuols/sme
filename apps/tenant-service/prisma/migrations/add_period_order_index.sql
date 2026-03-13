-- ============================================================
-- Migration: add orderIndex to Period table
-- Safe: uses IF NOT EXISTS / IF EXISTS guards — zero data loss
-- Run via:
--   $env:DATABASE_URL="postgresql://postgres:Olsbook55@localhost:5432/sme_tenant?schema=public"
--   npx prisma db execute --file ./prisma/migrations/add_period_order_index.sql --schema ./prisma/schema.prisma
-- ============================================================

-- 1. Add orderIndex column (INT, NOT NULL, default 0) if it does not already exist
ALTER TABLE "Period"
  ADD COLUMN IF NOT EXISTS "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- 2. Create the composite index for sorted period lookups  
CREATE INDEX IF NOT EXISTS "Period_tenantId_orderIndex_idx"
  ON "Period" ("tenantId", "orderIndex");
