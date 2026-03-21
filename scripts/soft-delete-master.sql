-- HARD DELETE — development environment only
-- Order respects FK RESTRICT constraints: children before parents

-- Step 1: FeeStructures (FK → AcademicYear + Class)
DELETE FROM "FeeStructure" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Step 2: Sections (FK → Class)
DELETE FROM "Section" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Step 3: Classes (FK → AcademicYear)
DELETE FROM "Class" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Step 4: Periods (FK → AcademicYear — must go before AcademicYears)
DELETE FROM "Period" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Step 5: AcademicYears (all FK children now removed)
DELETE FROM "AcademicYear" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Step 6: Subjects (independent)
DELETE FROM "Subject" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Step 7: FeeCategories (independent)
DELETE FROM "FeeCategory" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Step 8: GradeScales (independent)
DELETE FROM "GradeScale" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Step 9: ExamSchedules (independent)
DELETE FROM "ExamSchedule" WHERE "tenantId" = 'MASTER_TEMPLATE';

-- Verification: all counts must be 0
SELECT 'AcademicYear'  AS table_name, COUNT(*) AS remaining_rows FROM "AcademicYear"  WHERE "tenantId" = 'MASTER_TEMPLATE'
UNION ALL
SELECT 'Class',        COUNT(*) FROM "Class"        WHERE "tenantId" = 'MASTER_TEMPLATE'
UNION ALL
SELECT 'Section',      COUNT(*) FROM "Section"      WHERE "tenantId" = 'MASTER_TEMPLATE'
UNION ALL
SELECT 'Subject',      COUNT(*) FROM "Subject"      WHERE "tenantId" = 'MASTER_TEMPLATE'
UNION ALL
SELECT 'Period',       COUNT(*) FROM "Period"        WHERE "tenantId" = 'MASTER_TEMPLATE'
UNION ALL
SELECT 'FeeCategory',  COUNT(*) FROM "FeeCategory"  WHERE "tenantId" = 'MASTER_TEMPLATE'
UNION ALL
SELECT 'FeeStructure', COUNT(*) FROM "FeeStructure" WHERE "tenantId" = 'MASTER_TEMPLATE'
UNION ALL
SELECT 'GradeScale',   COUNT(*) FROM "GradeScale"   WHERE "tenantId" = 'MASTER_TEMPLATE'
UNION ALL
SELECT 'ExamSchedule', COUNT(*) FROM "ExamSchedule" WHERE "tenantId" = 'MASTER_TEMPLATE'
ORDER BY table_name;
