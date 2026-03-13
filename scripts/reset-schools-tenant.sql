-- Reset all school/tenant data from sme_tenant DB
-- Run: psql -U postgres -h localhost -p 5432 -d sme_tenant -f scripts/reset-schools-tenant.sql

BEGIN;

-- Analytics / aggregates (leaf — no dependents)
DELETE FROM "SubjectExamAnalytics";
DELETE FROM "ClassExamAggregate";
DELETE FROM "StudentExamAggregate";
DELETE FROM "StudentExamResult";
DELETE FROM "StudentMark";
DELETE FROM "ExamSubject";
DELETE FROM "Exam";

-- Attendance
DELETE FROM "AttendanceRecord";
DELETE FROM "AttendanceSession";

-- Timetable
DELETE FROM "Period";

-- Parent-student links, then parents
DELETE FROM "ParentStudentMapping";
DELETE FROM "Parent";

-- Enrollments then assignments then students/teachers/subjects/grades
DELETE FROM "StudentEnrollment";
DELETE FROM "ClassTeacherAssignment";
DELETE FROM "Student";
DELETE FROM "Teacher";
DELETE FROM "Subject";
DELETE FROM "GradeScale";

-- Section -> Class -> AcademicYear (Restrict FKs, deepest first)
DELETE FROM "Section";
DELETE FROM "Class";
DELETE FROM "AcademicYear";

-- Outbox / processed events
DELETE FROM "OutboxEvent";
DELETE FROM "ProcessedEvent";

-- Tenant children (Restrict/Cascade), then Tenant itself
DELETE FROM "TenantAdmin";
DELETE FROM "TenantSetting";
DELETE FROM "Tenant";

COMMIT;

SELECT 'Tenant DB reset complete - all schools deleted' AS status;
