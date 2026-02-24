-- CreateTable
CREATE TABLE "StudentExamAggregate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL,
    "classRank" INTEGER,
    "sectionRank" INTEGER,
    "gpa" DOUBLE PRECISION,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentExamAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassExamAggregate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "averageMarks" DOUBLE PRECISION NOT NULL,
    "averagePercentage" DOUBLE PRECISION NOT NULL,
    "highestMarks" DOUBLE PRECISION NOT NULL,
    "lowestMarks" DOUBLE PRECISION NOT NULL,
    "passPercentage" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassExamAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectExamAnalytics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "averageMarks" DOUBLE PRECISION NOT NULL,
    "highestMarks" DOUBLE PRECISION NOT NULL,
    "lowestMarks" DOUBLE PRECISION NOT NULL,
    "passPercentage" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectExamAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentExamAggregate_tenantId_idx" ON "StudentExamAggregate"("tenantId");

-- CreateIndex
CREATE INDEX "StudentExamAggregate_studentId_idx" ON "StudentExamAggregate"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentExamAggregate_tenantId_examId_studentId_key" ON "StudentExamAggregate"("tenantId", "examId", "studentId");

-- CreateIndex
CREATE INDEX "ClassExamAggregate_tenantId_idx" ON "ClassExamAggregate"("tenantId");

-- CreateIndex
CREATE INDEX "ClassExamAggregate_classId_idx" ON "ClassExamAggregate"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassExamAggregate_tenantId_examId_classId_key" ON "ClassExamAggregate"("tenantId", "examId", "classId");

-- CreateIndex
CREATE INDEX "SubjectExamAnalytics_tenantId_idx" ON "SubjectExamAnalytics"("tenantId");

-- CreateIndex
CREATE INDEX "SubjectExamAnalytics_subjectId_idx" ON "SubjectExamAnalytics"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectExamAnalytics_tenantId_examId_subjectId_key" ON "SubjectExamAnalytics"("tenantId", "examId", "subjectId");

-- AddForeignKey
ALTER TABLE "StudentExamAggregate" ADD CONSTRAINT "StudentExamAggregate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamAggregate" ADD CONSTRAINT "StudentExamAggregate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassExamAggregate" ADD CONSTRAINT "ClassExamAggregate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassExamAggregate" ADD CONSTRAINT "ClassExamAggregate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectExamAnalytics" ADD CONSTRAINT "SubjectExamAnalytics_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectExamAnalytics" ADD CONSTRAINT "SubjectExamAnalytics_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
