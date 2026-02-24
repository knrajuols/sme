-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "relation" TEXT NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudentMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "softDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentStudentMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Parent_tenantId_idx" ON "Parent"("tenantId");

-- CreateIndex
CREATE INDEX "Parent_userId_idx" ON "Parent"("userId");

-- CreateIndex
CREATE INDEX "ParentStudentMapping_tenantId_idx" ON "ParentStudentMapping"("tenantId");

-- CreateIndex
CREATE INDEX "ParentStudentMapping_studentId_idx" ON "ParentStudentMapping"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentMapping_tenantId_parentId_studentId_key" ON "ParentStudentMapping"("tenantId", "parentId", "studentId");

-- AddForeignKey
ALTER TABLE "ParentStudentMapping" ADD CONSTRAINT "ParentStudentMapping_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentMapping" ADD CONSTRAINT "ParentStudentMapping_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
