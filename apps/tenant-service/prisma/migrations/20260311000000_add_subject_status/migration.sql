-- ============================================================
-- Migration: add_subject_status
-- Date: 2026-03-11
-- Purpose: Add SubjectStatus enum and status column to Subject
--
-- DATA SAFETY GUARANTEE:
--   1. CREATE TYPE adds a new enum — no existing rows affected.
--   2. ADD COLUMN uses DEFAULT 'ACTIVE' — every existing Subject
--      row automatically receives ACTIVE status. Zero data loss.
-- ============================================================

-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable: add status with DEFAULT so all existing rows stay ACTIVE
ALTER TABLE "Subject"
  ADD COLUMN "status" "SubjectStatus" NOT NULL DEFAULT 'ACTIVE';
