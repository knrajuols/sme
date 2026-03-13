-- Manual SQL for Period model refactor
-- Remove classId and sectionId columns and FKs
ALTER TABLE "Period" DROP CONSTRAINT IF EXISTS "Period_classId_fkey";
ALTER TABLE "Period" DROP CONSTRAINT IF EXISTS "Period_sectionId_fkey";
ALTER TABLE "Period" DROP COLUMN IF EXISTS "classId";
ALTER TABLE "Period" DROP COLUMN IF EXISTS "sectionId";

-- Add startTime and endTime columns as VARCHAR(5) with default ''
ALTER TABLE "Period" ADD COLUMN IF NOT EXISTS "startTime" VARCHAR(5) DEFAULT '';
ALTER TABLE "Period" ADD COLUMN IF NOT EXISTS "endTime" VARCHAR(5) DEFAULT '';

-- Make academicYearId nullable
ALTER TABLE "Period" ALTER COLUMN "academicYearId" DROP NOT NULL;

-- Update unique constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Period_tenantId_academicYearId_classId_sectionId_name_key') THEN
    ALTER TABLE "Period" DROP CONSTRAINT "Period_tenantId_academicYearId_classId_sectionId_name_key";
  END IF;
END $$;
ALTER TABLE "Period" ADD CONSTRAINT "Period_tenantId_name_key" UNIQUE ("tenantId", "name");
