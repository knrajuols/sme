/*
  Warnings:

  - You are about to alter the column `tenantId` on the `AcademicYear` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `AcademicYear` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `createdBy` on the `AcademicYear` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `AcademicYear` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `AttendanceRecord` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `remarks` on the `AttendanceRecord` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `createdBy` on the `AttendanceRecord` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `AttendanceRecord` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `AttendanceSession` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - The `status` column on the `AttendanceSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `createdBy` on the `AttendanceSession` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `AttendanceSession` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `Class` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `Class` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `code` on the `Class` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `createdBy` on the `Class` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `Class` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `ClassExamAggregate` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `createdBy` on the `ClassExamAggregate` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `ClassExamAggregate` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `ClassTeacherAssignment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `createdBy` on the `ClassTeacherAssignment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `ClassTeacherAssignment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `Exam` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `Exam` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - The `status` column on the `Exam` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `createdBy` on the `Exam` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `Exam` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `ExamSubject` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `createdBy` on the `ExamSubject` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `ExamSubject` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `GradeScale` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `GradeScale` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `grade` on the `GradeScale` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `createdBy` on the `GradeScale` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `GradeScale` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `Parent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `userId` on the `Parent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `firstName` on the `Parent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `lastName` on the `Parent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `phone` on the `Parent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `email` on the `Parent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The `relation` column on the `Parent` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `createdBy` on the `Parent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `Parent` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `ParentStudentMapping` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `createdBy` on the `ParentStudentMapping` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `ParentStudentMapping` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `Period` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `Period` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `createdBy` on the `Period` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `Period` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `Section` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `Section` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `createdBy` on the `Section` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `Section` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `Student` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `admissionNumber` on the `Student` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `firstName` on the `Student` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `lastName` on the `Student` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The `gender` column on the `Student` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Student` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `createdBy` on the `Student` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `Student` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `StudentEnrollment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `rollNumber` on the `StudentEnrollment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `createdBy` on the `StudentEnrollment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `StudentEnrollment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `StudentExamAggregate` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `grade` on the `StudentExamAggregate` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `createdBy` on the `StudentExamAggregate` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `StudentExamAggregate` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `StudentExamResult` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `grade` on the `StudentExamResult` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `createdBy` on the `StudentExamResult` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `StudentExamResult` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `StudentMark` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `remarks` on the `StudentMark` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `createdBy` on the `StudentMark` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `StudentMark` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `Subject` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `Subject` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `code` on the `Subject` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `createdBy` on the `Subject` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `Subject` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `SubjectExamAnalytics` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `createdBy` on the `SubjectExamAnalytics` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `SubjectExamAnalytics` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `Teacher` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `userId` on the `Teacher` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `employeeCode` on the `Teacher` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `designation` on the `Teacher` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `createdBy` on the `Teacher` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `updatedBy` on the `Teacher` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `TenantAdmin` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `userId` on the `TenantAdmin` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tenantId` on the `TenantSetting` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `key` on the `TenantSetting` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - A unique constraint covering the columns `[tenantId,userId]` on the table `Parent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[apaarId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[udiseCode]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `status` on the `AttendanceRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'GRADUATED', 'DROPPED_OUT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StudentCategory" AS ENUM ('GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'PWD', 'CWSN');

-- CreateEnum
CREATE TYPE "Religion" AS ENUM ('HINDUISM', 'ISLAM', 'CHRISTIANITY', 'SIKHISM', 'BUDDHISM', 'JAINISM', 'OTHER', 'NOT_STATED');

-- CreateEnum
CREATE TYPE "Relation" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN', 'GRANDPARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('CORE', 'ELECTIVE', 'OPTIONAL', 'LANGUAGE', 'CO_CURRICULAR');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'VERIFIED', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AcademicYear" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "AttendanceRecord" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "AttendanceStatus" NOT NULL,
ALTER COLUMN "remarks" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "AttendanceSession" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'OPEN',
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "code" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "ClassExamAggregate" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "ClassTeacherAssignment" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Exam" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(200),
DROP COLUMN "status",
ADD COLUMN     "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "ExamSubject" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "GradeScale" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "grade" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "aadhaarMasked" VARCHAR(10),
ADD COLUMN     "addressLine" VARCHAR(500),
ADD COLUMN     "alternatePhone" VARCHAR(20),
ADD COLUMN     "annualIncomeSlab" VARCHAR(50),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "education" VARCHAR(100),
ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'PREFER_NOT_TO_SAY',
ADD COLUMN     "knownLanguages" VARCHAR(200),
ADD COLUMN     "motherTongue" VARCHAR(50),
ADD COLUMN     "pincode" VARCHAR(10),
ADD COLUMN     "profession" VARCHAR(100),
ADD COLUMN     "state" VARCHAR(100),
ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
DROP COLUMN "relation",
ADD COLUMN     "relation" "Relation" NOT NULL DEFAULT 'GUARDIAN',
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "ParentStudentMapping" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Period" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "classTeacherId" TEXT,
ADD COLUMN     "maxCapacity" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "roomLabel" VARCHAR(50),
ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "aadhaarMasked" VARCHAR(10),
ADD COLUMN     "addressLine" VARCHAR(500),
ADD COLUMN     "allergies" VARCHAR(500),
ADD COLUMN     "apaarId" VARCHAR(30),
ADD COLUMN     "bloodGroup" "BloodGroup" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "caste" VARCHAR(100),
ADD COLUMN     "category" "StudentCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "dateOfJoining" DATE,
ADD COLUMN     "dateOfLeaving" DATE,
ADD COLUMN     "disabilityType" VARCHAR(200),
ADD COLUMN     "emergencyContact" VARCHAR(500),
ADD COLUMN     "isBpl" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isCwsn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMinority" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRteAdmission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leavingReason" VARCHAR(200),
ADD COLUMN     "medicalConditions" VARCHAR(500),
ADD COLUMN     "middleName" VARCHAR(100),
ADD COLUMN     "motherTongue" VARCHAR(50),
ADD COLUMN     "nationality" VARCHAR(50) NOT NULL DEFAULT 'Indian',
ADD COLUMN     "photoUrl" VARCHAR(500),
ADD COLUMN     "pincode" VARCHAR(10),
ADD COLUMN     "preferredGender" VARCHAR(50),
ADD COLUMN     "preferredName" VARCHAR(100),
ADD COLUMN     "previousSchool" VARCHAR(200),
ADD COLUMN     "religion" "Religion" NOT NULL DEFAULT 'NOT_STATED',
ADD COLUMN     "state" VARCHAR(100),
ADD COLUMN     "tcNumber" VARCHAR(50),
ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "admissionNumber" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "dateOfBirth" DROP NOT NULL,
ALTER COLUMN "dateOfBirth" SET DATA TYPE DATE,
DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'PREFER_NOT_TO_SAY',
DROP COLUMN "status",
ADD COLUMN     "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "StudentEnrollment" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "rollNumber" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "StudentExamAggregate" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "grade" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "StudentExamResult" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "grade" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "StudentMark" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "remarks" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "countForRank" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hasPractical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "medium" VARCHAR(50),
ADD COLUMN     "periodsPerWeek" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "practicalMaxMarks" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "syllabusRef" VARCHAR(200),
ADD COLUMN     "theoryMaxMarks" DOUBLE PRECISION DEFAULT 100,
ADD COLUMN     "type" "SubjectType" NOT NULL DEFAULT 'CORE',
ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "code" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "SubjectExamAnalytics" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "aadhaarMasked" VARCHAR(10),
ADD COLUMN     "category" "StudentCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "contactPhone" VARCHAR(20),
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "dateOfJoining" DATE,
ADD COLUMN     "dateOfLeaving" DATE,
ADD COLUMN     "emergencyContact" VARCHAR(500),
ADD COLUMN     "employmentType" VARCHAR(50),
ADD COLUMN     "firstName" VARCHAR(100),
ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'PREFER_NOT_TO_SAY',
ADD COLUMN     "knownLanguages" VARCHAR(200),
ADD COLUMN     "lastName" VARCHAR(100),
ADD COLUMN     "motherTongue" VARCHAR(50),
ADD COLUMN     "nationality" VARCHAR(50) NOT NULL DEFAULT 'Indian',
ADD COLUMN     "photoUrl" VARCHAR(500),
ADD COLUMN     "qualifications" VARCHAR(1000),
ADD COLUMN     "religion" "Religion" NOT NULL DEFAULT 'NOT_STATED',
ADD COLUMN     "subjectSpecialization" VARCHAR(200),
ADD COLUMN     "tetCertificateNo" VARCHAR(50),
ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "employeeCode" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "designation" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "updatedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "address" VARCHAR(500),
ADD COLUMN     "affiliationNumber" VARCHAR(50),
ADD COLUMN     "board" VARCHAR(100),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "contactEmail" VARCHAR(255),
ADD COLUMN     "contactPhone" VARCHAR(20),
ADD COLUMN     "district" VARCHAR(100),
ADD COLUMN     "establishmentYear" INTEGER,
ADD COLUMN     "highestClass" VARCHAR(10),
ADD COLUMN     "lowestClass" VARCHAR(10),
ADD COLUMN     "managementType" VARCHAR(100),
ADD COLUMN     "pincode" VARCHAR(10),
ADD COLUMN     "schoolStatus" "SchoolStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "schoolType" VARCHAR(50),
ADD COLUMN     "state" VARCHAR(100),
ADD COLUMN     "udiseCode" VARCHAR(11),
ADD COLUMN     "website" VARCHAR(255);

-- AlterTable
ALTER TABLE "TenantAdmin" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "TenantSetting" ALTER COLUMN "tenantId" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "key" SET DATA TYPE VARCHAR(200);

-- CreateIndex
CREATE INDEX "AcademicYear_tenantId_isActive_idx" ON "AcademicYear"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_studentId_idx" ON "AttendanceRecord"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "AttendanceSession_tenantId_classId_date_idx" ON "AttendanceSession"("tenantId", "classId", "date");

-- CreateIndex
CREATE INDEX "Class_tenantId_code_idx" ON "Class"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ClassExamAggregate_examId_idx" ON "ClassExamAggregate"("examId");

-- CreateIndex
CREATE INDEX "Exam_tenantId_status_idx" ON "Exam"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ExamSubject_subjectId_idx" ON "ExamSubject"("subjectId");

-- CreateIndex
CREATE INDEX "GradeScale_tenantId_minPercentage_maxPercentage_idx" ON "GradeScale"("tenantId", "minPercentage", "maxPercentage");

-- CreateIndex
CREATE UNIQUE INDEX "Parent_tenantId_userId_key" ON "Parent"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ParentStudentMapping_parentId_idx" ON "ParentStudentMapping"("parentId");

-- CreateIndex
CREATE INDEX "Period_tenantId_classId_sectionId_idx" ON "Period"("tenantId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "Section_classTeacherId_idx" ON "Section"("classTeacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_apaarId_key" ON "Student"("apaarId");

-- CreateIndex
CREATE INDEX "Student_tenantId_lastName_firstName_idx" ON "Student"("tenantId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Student_tenantId_status_idx" ON "Student"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Student_tenantId_category_idx" ON "Student"("tenantId", "category");

-- CreateIndex
CREATE INDEX "Student_tenantId_isRteAdmission_idx" ON "Student"("tenantId", "isRteAdmission");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "StudentExamAggregate_examId_idx" ON "StudentExamAggregate"("examId");

-- CreateIndex
CREATE INDEX "StudentExamResult_examId_idx" ON "StudentExamResult"("examId");

-- CreateIndex
CREATE INDEX "StudentMark_tenantId_studentId_examId_idx" ON "StudentMark"("tenantId", "studentId", "examId");

-- CreateIndex
CREATE INDEX "StudentMark_tenantId_subjectId_examId_idx" ON "StudentMark"("tenantId", "subjectId", "examId");

-- CreateIndex
CREATE INDEX "Subject_tenantId_code_idx" ON "Subject"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Subject_tenantId_type_idx" ON "Subject"("tenantId", "type");

-- CreateIndex
CREATE INDEX "SubjectExamAnalytics_examId_idx" ON "SubjectExamAnalytics"("examId");

-- CreateIndex
CREATE INDEX "Teacher_tenantId_employmentType_idx" ON "Teacher"("tenantId", "employmentType");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_udiseCode_key" ON "Tenant"("udiseCode");

-- AddForeignKey
ALTER TABLE "TenantSetting" ADD CONSTRAINT "TenantSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAdmin" ADD CONSTRAINT "TenantAdmin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
