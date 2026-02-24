import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import type { JwtClaims } from '@sme/auth';
import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  EventEnvelope,
} from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';

import { AddExamSubjectDto } from './dto/add-exam-subject.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { EnterStudentMarksDto } from './dto/enter-student-marks.dto';
import { PrismaService } from './prisma/prisma.service';

interface RequestContext {
  tenantId: string;
  user: JwtClaims;
  correlationId: string;
}

interface ExamEntity {
  id: string;
  name: string;
  academicYearId: string;
  classId: string;
  status: string;
}

interface StudentTotalRow {
  studentId: string;
  total: number;
  sectionId: string | null;
}

interface StudentComputedMetrics {
  studentId: string;
  sectionId: string | null;
  totalMarks: number;
  percentage: number;
  grade: string;
  classRank: number | null;
  sectionRank: number | null;
  gpa: number;
}

@Injectable()
export class ExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MessagePublisherService,
  ) {}

  async createExam(dto: CreateExamDto, context: RequestContext): Promise<{ id: string }> {
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('startDate must be less than or equal to endDate');
    }

    await this.assertEntityExists('AcademicYear', dto.academicYearId, context.tenantId);
    await this.assertEntityExists('Class', dto.classId, context.tenantId);

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Exam" (
        "id", "tenantId", "name", "academicYearId", "classId", "status", "startDate", "endDate", "totalMarks",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.name}, ${dto.academicYearId}, ${dto.classId}, 'DRAFT', ${dto.startDate}, ${dto.endDate}, ${dto.totalMarks ?? null},
        ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'Exam', id, 'Exam created', { name: dto.name });
    return { id };
  }

  async addExamSubject(examId: string, dto: AddExamSubjectDto, context: RequestContext): Promise<{ id: string }> {
    const exam = await this.getExam(examId, context.tenantId);
    this.assertExamNotPublished(exam);
    await this.assertEntityExists('Subject', dto.subjectId, context.tenantId);

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "ExamSubject" (
        "id", "tenantId", "examId", "subjectId", "maxMarks", "weightage",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${examId}, ${dto.subjectId}, ${dto.maxMarks}, ${dto.weightage ?? null},
        ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'ExamSubject', id, 'Exam subject added', { examId, subjectId: dto.subjectId });
    return { id };
  }

  async enterMarks(examId: string, dto: EnterStudentMarksDto, context: RequestContext): Promise<{ upsertedCount: number }> {
    const exam = await this.getExam(examId, context.tenantId);
    this.assertExamNotPublished(exam);

    const examSubjectRows = await this.prisma.$queryRaw<Array<{ maxMarks: number }>>`
      SELECT "maxMarks"
      FROM "ExamSubject"
      WHERE "tenantId" = ${context.tenantId}
        AND "examId" = ${examId}
        AND "subjectId" = ${dto.subjectId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const examSubject = examSubjectRows[0];
    if (!examSubject) {
      throw new NotFoundException('Exam subject mapping not found');
    }

    for (const entry of dto.marks) {
      if (entry.marksObtained > Number(examSubject.maxMarks)) {
        throw new BadRequestException(`marksObtained exceeds maxMarks for student ${entry.studentId}`);
      }

      const enrollment = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "StudentEnrollment"
        WHERE "tenantId" = ${context.tenantId}
          AND "studentId" = ${entry.studentId}
          AND "classId" = ${exam.classId}
          AND "academicYearId" = ${exam.academicYearId}
          AND "softDelete" = false
        LIMIT 1
      `;

      if (enrollment.length === 0) {
        throw new ForbiddenException(`Student ${entry.studentId} is not enrolled for exam class/academic year`);
      }

      await this.prisma.$executeRaw`
        INSERT INTO "StudentMark" (
          "id", "tenantId", "examId", "subjectId", "studentId", "marksObtained", "remarks",
          "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${context.tenantId}, ${examId}, ${dto.subjectId}, ${entry.studentId}, ${entry.marksObtained}, ${entry.remarks ?? null},
          ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
        )
        ON CONFLICT ("tenantId", "examId", "subjectId", "studentId") DO UPDATE SET
          "marksObtained" = EXCLUDED."marksObtained",
          "remarks" = EXCLUDED."remarks",
          "updatedBy" = EXCLUDED."updatedBy",
          "updatedAt" = EXCLUDED."updatedAt"
      `;
    }

    await this.publishAudit(context, 'MARKS_ENTER', 'StudentMark', examId, 'Student marks entered', {
      examId,
      subjectId: dto.subjectId,
      count: dto.marks.length,
    });

    return { upsertedCount: dto.marks.length };
  }

  async verifyExam(id: string, context: RequestContext): Promise<{ id: string; status: string }> {
    const exam = await this.getExam(id, context.tenantId);

    if (exam.status === 'PUBLISHED') {
      throw new BadRequestException('Published exam is immutable');
    }

    if (exam.status === 'VERIFIED') {
      return { id: exam.id, status: exam.status };
    }

    await this.prisma.$executeRaw`
      UPDATE "Exam"
      SET "status" = 'VERIFIED', "updatedBy" = ${context.user.sub}, "updatedAt" = ${new Date()}
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId} AND "softDelete" = false
    `;

    await this.publishAudit(context, 'VERIFY', 'Exam', id, 'Exam verified');
    return { id, status: 'VERIFIED' };
  }

  async publishExam(id: string, context: RequestContext): Promise<{ id: string; status: string; resultCount: number }> {
    const exam = await this.getExam(id, context.tenantId);

    if (exam.status !== 'VERIFIED' && exam.status !== 'PUBLISHED') {
      throw new BadRequestException('Only VERIFIED or PUBLISHED exam can be processed for publish');
    }

    const resultCount = await this.prisma.$transaction(async (transactionClient) => {
      await this.ensureDefaultGradeScale(transactionClient, context.tenantId, context.user.sub);

      const subjects = await transactionClient.$queryRaw<Array<{ subjectId: string; maxMarks: number }>>`
        SELECT "subjectId", "maxMarks"
        FROM "ExamSubject"
        WHERE "tenantId" = ${context.tenantId}
          AND "examId" = ${id}
          AND "softDelete" = false
        ORDER BY "subjectId" ASC
      `;

      if (subjects.length === 0) {
        throw new BadRequestException('Cannot publish exam without exam subjects');
      }

      const totalMax = subjects.reduce((sum, item) => sum + Number(item.maxMarks), 0);
      if (totalMax <= 0) {
        throw new BadRequestException('Cannot publish exam with non-positive total max marks');
      }

      const studentTotals = await transactionClient.$queryRaw<Array<StudentTotalRow>>`
        SELECT
          marks."studentId",
          SUM(marks."marksObtained")::float AS "total",
          enrollment."sectionId" AS "sectionId"
        FROM "StudentMark" marks
        LEFT JOIN "StudentEnrollment" enrollment
          ON enrollment."tenantId" = marks."tenantId"
         AND enrollment."studentId" = marks."studentId"
         AND enrollment."academicYearId" = ${exam.academicYearId}
         AND enrollment."classId" = ${exam.classId}
         AND enrollment."softDelete" = false
        WHERE marks."tenantId" = ${context.tenantId}
          AND marks."examId" = ${id}
          AND marks."softDelete" = false
        GROUP BY marks."studentId", enrollment."sectionId"
      `;

      if (studentTotals.length === 0) {
        throw new BadRequestException('Cannot publish exam without student marks');
      }

      const computedMetrics: StudentComputedMetrics[] = [];
      for (const row of studentTotals) {
        const percentage = Number(((Number(row.total) / totalMax) * 100).toFixed(2));
        const grade = await this.resolveGrade(transactionClient, context.tenantId, percentage);

        await transactionClient.$executeRaw`
          INSERT INTO "StudentExamResult" (
            "id", "tenantId", "examId", "studentId", "totalMarks", "percentage", "grade",
            "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${context.tenantId}, ${id}, ${row.studentId}, ${Number(row.total)}, ${percentage}, ${grade},
            ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
          )
          ON CONFLICT ("tenantId", "examId", "studentId") DO UPDATE SET
            "totalMarks" = EXCLUDED."totalMarks",
            "percentage" = EXCLUDED."percentage",
            "grade" = EXCLUDED."grade",
            "updatedBy" = EXCLUDED."updatedBy",
            "updatedAt" = EXCLUDED."updatedAt",
            "softDelete" = false
        `;

        computedMetrics.push({
          studentId: row.studentId,
          sectionId: row.sectionId,
          totalMarks: Number(row.total),
          percentage,
          grade,
          classRank: null,
          sectionRank: null,
          gpa: this.mapGradeToGpa(grade),
        });
      }

      this.assignClassRank(computedMetrics);
      this.assignSectionRank(computedMetrics);

      await this.rebuildAggregates(transactionClient, context, exam, id, computedMetrics);

      await transactionClient.$executeRaw`
        UPDATE "Exam"
        SET "status" = 'PUBLISHED', "totalMarks" = ${totalMax}, "updatedBy" = ${context.user.sub}, "updatedAt" = ${new Date()}
        WHERE "id" = ${id} AND "tenantId" = ${context.tenantId} AND "softDelete" = false
      `;

      return computedMetrics.length;
    });

    await this.publishAudit(context, 'PUBLISH', 'Exam', id, 'Exam published', {
      resultCount,
    });

    return {
      id,
      status: 'PUBLISHED',
      resultCount,
    };
  }

  async getExamById(id: string, tenantId: string): Promise<{
    id: string;
    name: string;
    academicYearId: string;
    classId: string;
    status: string;
    startDate: Date;
    endDate: Date;
    totalMarks: number | null;
    subjects: Array<{ subjectId: string; maxMarks: number; weightage: number | null }>;
  }> {
    const examRows = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      academicYearId: string;
      classId: string;
      status: string;
      startDate: Date;
      endDate: Date;
      totalMarks: number | null;
    }>>`
      SELECT "id", "name", "academicYearId", "classId", "status", "startDate", "endDate", "totalMarks"
      FROM "Exam"
      WHERE "id" = ${id}
        AND "tenantId" = ${tenantId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const exam = examRows[0];
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const subjects = await this.prisma.$queryRaw<Array<{ subjectId: string; maxMarks: number; weightage: number | null }>>`
      SELECT "subjectId", "maxMarks", "weightage"
      FROM "ExamSubject"
      WHERE "tenantId" = ${tenantId}
        AND "examId" = ${id}
        AND "softDelete" = false
      ORDER BY "subjectId" ASC
    `;

    return {
      ...exam,
      subjects,
    };
  }

  async getExamResults(id: string, tenantId: string): Promise<Array<{
    studentId: string;
    totalMarks: number;
    percentage: number;
    grade: string;
  }>> {
    await this.getExam(id, tenantId);

    return this.prisma.$queryRaw<Array<{
      studentId: string;
      totalMarks: number;
      percentage: number;
      grade: string;
    }>>`
      SELECT "studentId", "totalMarks", "percentage", "grade"
      FROM "StudentExamResult"
      WHERE "tenantId" = ${tenantId}
        AND "examId" = ${id}
        AND "softDelete" = false
      ORDER BY "studentId" ASC
    `;
  }

  async getStudentResults(studentId: string, tenantId: string): Promise<Array<{
    examId: string;
    totalMarks: number;
    percentage: number;
    grade: string;
  }>> {
    await this.assertEntityExists('Student', studentId, tenantId);

    return this.prisma.$queryRaw<Array<{
      examId: string;
      totalMarks: number;
      percentage: number;
      grade: string;
    }>>`
      SELECT "examId", "totalMarks", "percentage", "grade"
      FROM "StudentExamResult"
      WHERE "tenantId" = ${tenantId}
        AND "studentId" = ${studentId}
        AND "softDelete" = false
      ORDER BY "createdAt" DESC
    `;
  }

  private async getExam(id: string, tenantId: string): Promise<ExamEntity> {
    const rows = await this.prisma.$queryRaw<Array<ExamEntity>>`
      SELECT "id", "name", "academicYearId", "classId", "status"
      FROM "Exam"
      WHERE "id" = ${id}
        AND "tenantId" = ${tenantId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const exam = rows[0];
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    return exam;
  }

  private assertExamNotPublished(exam: ExamEntity): void {
    if (exam.status === 'PUBLISHED') {
      throw new BadRequestException('Published exam is immutable');
    }
  }

  private async resolveGrade(
    prismaClient: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    percentage: number,
  ): Promise<string> {
    const rows = await prismaClient.$queryRaw<Array<{ grade: string }>>`
      SELECT "grade"
      FROM "GradeScale"
      WHERE "tenantId" = ${tenantId}
        AND "softDelete" = false
        AND ${percentage} >= "minPercentage"
      ORDER BY "minPercentage" DESC
      LIMIT 1
    `;

    return rows[0]?.grade ?? 'N/A';
  }

  private async ensureDefaultGradeScale(
    prismaClient: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const defaults = [
      { min: 90, max: 100, grade: 'A+' },
      { min: 80, max: 100, grade: 'A' },
      { min: 70, max: 100, grade: 'B' },
      { min: 60, max: 100, grade: 'C' },
      { min: 50, max: 100, grade: 'D' },
      { min: 0, max: 100, grade: 'F' },
    ];

    for (const item of defaults) {
      await prismaClient.$executeRaw`
        INSERT INTO "GradeScale" (
          "id", "tenantId", "name", "minPercentage", "maxPercentage", "grade",
          "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${tenantId}, 'DEFAULT', ${item.min}, ${item.max}, ${item.grade},
          ${userId}, ${userId}, false, ${new Date()}, ${new Date()}
        )
        ON CONFLICT ("tenantId", "name", "minPercentage") DO NOTHING
      `;
    }
  }

  private assignClassRank(metrics: StudentComputedMetrics[]): void {
    const sortedMetrics = [...metrics].sort((left, right) => {
      if (right.percentage !== left.percentage) {
        return right.percentage - left.percentage;
      }

      return left.studentId.localeCompare(right.studentId);
    });

    let previousPercentage: number | null = null;
    let previousRank = 0;
    sortedMetrics.forEach((metric, index) => {
      if (previousPercentage !== null && metric.percentage === previousPercentage) {
        metric.classRank = previousRank;
      } else {
        metric.classRank = index + 1;
        previousRank = metric.classRank;
        previousPercentage = metric.percentage;
      }
    });

    const byStudent = new Map(sortedMetrics.map((metric) => [metric.studentId, metric.classRank]));
    metrics.forEach((metric) => {
      metric.classRank = byStudent.get(metric.studentId) ?? null;
    });
  }

  private assignSectionRank(metrics: StudentComputedMetrics[]): void {
    const sectionMap = new Map<string, StudentComputedMetrics[]>();
    metrics.forEach((metric) => {
      const sectionId = metric.sectionId ?? 'UNASSIGNED';
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, []);
      }

      sectionMap.get(sectionId)?.push(metric);
    });

    sectionMap.forEach((sectionMetrics) => {
      sectionMetrics.sort((left, right) => {
        if (right.percentage !== left.percentage) {
          return right.percentage - left.percentage;
        }

        return left.studentId.localeCompare(right.studentId);
      });

      let previousPercentage: number | null = null;
      let previousRank = 0;
      sectionMetrics.forEach((metric, index) => {
        if (previousPercentage !== null && metric.percentage === previousPercentage) {
          metric.sectionRank = previousRank;
        } else {
          metric.sectionRank = index + 1;
          previousRank = metric.sectionRank;
          previousPercentage = metric.percentage;
        }
      });
    });
  }

  private mapGradeToGpa(grade: string): number {
    const mapping: Record<string, number> = {
      'A+': 4.0,
      A: 3.5,
      B: 3.0,
      C: 2.5,
      D: 2.0,
      F: 0,
    };

    return mapping[grade] ?? 0;
  }

  private async rebuildAggregates(
    prismaClient: Prisma.TransactionClient,
    context: RequestContext,
    exam: ExamEntity,
    examId: string,
    metrics: StudentComputedMetrics[],
  ): Promise<void> {
    await prismaClient.$executeRaw`
      DELETE FROM "StudentExamAggregate"
      WHERE "tenantId" = ${context.tenantId} AND "examId" = ${examId}
    `;
    await prismaClient.$executeRaw`
      DELETE FROM "ClassExamAggregate"
      WHERE "tenantId" = ${context.tenantId} AND "examId" = ${examId}
    `;
    await prismaClient.$executeRaw`
      DELETE FROM "SubjectExamAnalytics"
      WHERE "tenantId" = ${context.tenantId} AND "examId" = ${examId}
    `;

    for (const metric of metrics) {
      await prismaClient.$executeRaw`
        INSERT INTO "StudentExamAggregate" (
          "id", "tenantId", "examId", "studentId", "totalMarks", "percentage", "grade", "classRank", "sectionRank", "gpa",
          "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${context.tenantId}, ${examId}, ${metric.studentId}, ${metric.totalMarks}, ${metric.percentage}, ${metric.grade}, ${metric.classRank}, ${metric.sectionRank}, ${metric.gpa},
          ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
        )
      `;
    }

    const markTotals = metrics.map((metric) => metric.totalMarks);
    const percentageTotals = metrics.map((metric) => metric.percentage);
    const averageMarks = Number((markTotals.reduce((sum, value) => sum + value, 0) / metrics.length).toFixed(2));
    const averagePercentage = Number((percentageTotals.reduce((sum, value) => sum + value, 0) / metrics.length).toFixed(2));
    const highestMarks = Math.max(...markTotals);
    const lowestMarks = Math.min(...markTotals);
    const passCount = metrics.filter((metric) => metric.percentage >= 40).length;
    const passPercentage = Number(((passCount / metrics.length) * 100).toFixed(2));

    await prismaClient.$executeRaw`
      INSERT INTO "ClassExamAggregate" (
        "id", "tenantId", "examId", "classId", "averageMarks", "averagePercentage", "highestMarks", "lowestMarks", "passPercentage",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${context.tenantId}, ${examId}, ${exam.classId}, ${averageMarks}, ${averagePercentage}, ${highestMarks}, ${lowestMarks}, ${passPercentage},
        ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
      )
      ON CONFLICT ("tenantId", "examId", "classId") DO UPDATE SET
        "averageMarks" = EXCLUDED."averageMarks",
        "averagePercentage" = EXCLUDED."averagePercentage",
        "highestMarks" = EXCLUDED."highestMarks",
        "lowestMarks" = EXCLUDED."lowestMarks",
        "passPercentage" = EXCLUDED."passPercentage",
        "updatedBy" = EXCLUDED."updatedBy",
        "updatedAt" = EXCLUDED."updatedAt",
        "softDelete" = false
    `;

    const subjectAnalyticsRows = await prismaClient.$queryRaw<Array<{
      subjectId: string;
      averageMarks: number | null;
      highestMarks: number | null;
      lowestMarks: number | null;
      passPercentage: number | null;
    }>>`
      SELECT
        examSubject."subjectId" AS "subjectId",
        AVG(studentMark."marksObtained")::float AS "averageMarks",
        MAX(studentMark."marksObtained")::float AS "highestMarks",
        MIN(studentMark."marksObtained")::float AS "lowestMarks",
        (
          COALESCE(
            (
              COUNT(*) FILTER (
                WHERE studentMark."marksObtained" IS NOT NULL
                  AND ((studentMark."marksObtained" / NULLIF(examSubject."maxMarks", 0)) * 100) >= 40
              )::float
              * 100
            ) / NULLIF(COUNT(studentMark."id"), 0),
            0
          )
        )::float AS "passPercentage"
      FROM "ExamSubject" examSubject
      LEFT JOIN "StudentMark" studentMark
        ON studentMark."tenantId" = examSubject."tenantId"
       AND studentMark."examId" = examSubject."examId"
       AND studentMark."subjectId" = examSubject."subjectId"
       AND studentMark."softDelete" = false
      WHERE examSubject."tenantId" = ${context.tenantId}
        AND examSubject."examId" = ${examId}
        AND examSubject."softDelete" = false
      GROUP BY examSubject."subjectId", examSubject."maxMarks"
    `;

    for (const subjectAnalytics of subjectAnalyticsRows) {
      await prismaClient.$executeRaw`
        INSERT INTO "SubjectExamAnalytics" (
          "id", "tenantId", "examId", "subjectId", "averageMarks", "highestMarks", "lowestMarks", "passPercentage",
          "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${context.tenantId}, ${examId}, ${subjectAnalytics.subjectId},
          ${Number(subjectAnalytics.averageMarks ?? 0)}, ${Number(subjectAnalytics.highestMarks ?? 0)}, ${Number(subjectAnalytics.lowestMarks ?? 0)}, ${Number(subjectAnalytics.passPercentage ?? 0)},
          ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
        )
        ON CONFLICT ("tenantId", "examId", "subjectId") DO UPDATE SET
          "averageMarks" = EXCLUDED."averageMarks",
          "highestMarks" = EXCLUDED."highestMarks",
          "lowestMarks" = EXCLUDED."lowestMarks",
          "passPercentage" = EXCLUDED."passPercentage",
          "updatedBy" = EXCLUDED."updatedBy",
          "updatedAt" = EXCLUDED."updatedAt",
          "softDelete" = false
      `;
    }
  }

  private async assertEntityExists(tableName: string, id: string, tenantId: string): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "${tableName}" WHERE "id" = $1 AND "tenantId" = $2 AND "softDelete" = false LIMIT 1`,
      id,
      tenantId,
    );

    if (rows.length === 0) {
      throw new NotFoundException(`${tableName} not found for tenant scope`);
    }
  }

  private async publishAudit(
    context: RequestContext,
    action: string,
    entity: string,
    entityId: string,
    summary: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const payload: AuditEventRequestedPayload = {
      action,
      entity,
      entityId,
      summary,
      metadata,
    };

    const envelope: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId: context.tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId,
      producer: { service: 'tenant-service' },
      actor: {
        actorType: 'USER',
        actorId: context.user.sub,
        role: context.user.roles[0] ?? 'USER',
      },
      payload,
    };

    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, envelope);
  }
}