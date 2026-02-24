import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import type { JwtClaims } from '@sme/auth';
import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  EventEnvelope,
} from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';

import { PrismaService } from './prisma/prisma.service';

interface PortalRequestContext {
  tenantId: string;
  user: JwtClaims;
  correlationId: string;
}

interface ParentEntity {
  id: string;
  tenantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  relation: string;
}

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MessagePublisherService,
  ) {}

  async getProfile(context: PortalRequestContext): Promise<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    relation: string;
  }> {
    const parent = await this.getParentByUser(context.tenantId, context.user.sub);

    await this.publishAudit(context, 'PORTAL_LOGIN', 'PortalSession', parent.id, 'Parent portal profile viewed');

    return {
      id: parent.id,
      firstName: parent.firstName,
      lastName: parent.lastName,
      phone: parent.phone,
      email: parent.email,
      relation: parent.relation,
    };
  }

  async getStudents(context: PortalRequestContext): Promise<Array<{
    studentId: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    status: string;
  }>> {
    const parent = await this.getParentByUser(context.tenantId, context.user.sub);

    return this.prisma.$queryRaw<Array<{
      studentId: string;
      admissionNumber: string;
      firstName: string;
      lastName: string;
      status: string;
    }>>`
      SELECT
        student."id" as "studentId",
        student."admissionNumber",
        student."firstName",
        student."lastName",
        student."status"
      FROM "ParentStudentMapping" mapping
      INNER JOIN "Student" student
        ON student."id" = mapping."studentId"
       AND student."tenantId" = mapping."tenantId"
      WHERE mapping."tenantId" = ${context.tenantId}
        AND mapping."parentId" = ${parent.id}
        AND mapping."softDelete" = false
        AND student."softDelete" = false
      ORDER BY student."firstName" ASC, student."lastName" ASC
    `;
  }

  async getStudentAttendance(
    studentId: string,
    context: PortalRequestContext,
  ): Promise<{ totalDays: number; presentDays: number; absentDays: number; percentage: number }> {
    await this.assertMappedStudent(studentId, context);

    return this.getAttendanceSummary(studentId, context.tenantId);
  }

  async getStudentResults(
    studentId: string,
    context: PortalRequestContext,
  ): Promise<Array<{
    examId: string;
    examName: string;
    totalMarks: number;
    percentage: number;
    grade: string;
    classRank: number | null;
    sectionRank: number | null;
    gpa: number | null;
  }>> {
    await this.assertMappedStudent(studentId, context);

    const rows = await this.prisma.$queryRaw<Array<{
      examId: string;
      examName: string;
      totalMarks: number;
      percentage: number;
      grade: string;
      classRank: number | null;
      sectionRank: number | null;
      gpa: number | null;
    }>>`
      SELECT
        aggregate."examId",
        exam."name" as "examName",
        aggregate."totalMarks",
        aggregate."percentage",
        aggregate."grade",
        aggregate."classRank",
        aggregate."sectionRank",
        aggregate."gpa"
      FROM "StudentExamAggregate" aggregate
      INNER JOIN "Exam" exam
        ON exam."id" = aggregate."examId"
       AND exam."tenantId" = aggregate."tenantId"
      WHERE aggregate."tenantId" = ${context.tenantId}
        AND aggregate."studentId" = ${studentId}
        AND aggregate."softDelete" = false
        AND exam."softDelete" = false
      ORDER BY exam."endDate" DESC, aggregate."createdAt" DESC
      LIMIT 20
    `;

    await this.publishAudit(
      context,
      'PORTAL_RESULT_VIEW',
      'StudentExamAggregate',
      studentId,
      'Parent viewed student exam results',
      { studentId },
    );

    return rows;
  }

  async getStudentAnalytics(
    studentId: string,
    context: PortalRequestContext,
  ): Promise<{
    studentProfile: {
      studentId: string;
      admissionNumber: string;
      firstName: string;
      lastName: string;
      status: string;
    };
    attendanceSummary: { totalDays: number; presentDays: number; absentDays: number; percentage: number };
    latestExamResult: {
      examId: string;
      examName: string;
      totalMarks: number;
      percentage: number;
      grade: string;
    } | null;
    rank: { classRank: number | null; sectionRank: number | null };
    gpa: number | null;
    correlationLabel: string;
  }> {
    const student = await this.assertMappedStudent(studentId, context);

    const attendanceSummary = await this.getAttendanceSummary(studentId, context.tenantId);

    const latestRows = await this.prisma.$queryRaw<Array<{
      examId: string;
      examName: string;
      totalMarks: number;
      percentage: number;
      grade: string;
      classRank: number | null;
      sectionRank: number | null;
      gpa: number | null;
      startDate: Date;
      endDate: Date;
    }>>`
      SELECT
        aggregate."examId",
        exam."name" as "examName",
        aggregate."totalMarks",
        aggregate."percentage",
        aggregate."grade",
        aggregate."classRank",
        aggregate."sectionRank",
        aggregate."gpa",
        exam."startDate",
        exam."endDate"
      FROM "StudentExamAggregate" aggregate
      INNER JOIN "Exam" exam
        ON exam."id" = aggregate."examId"
       AND exam."tenantId" = aggregate."tenantId"
      WHERE aggregate."tenantId" = ${context.tenantId}
        AND aggregate."studentId" = ${studentId}
        AND aggregate."softDelete" = false
        AND exam."softDelete" = false
      ORDER BY exam."endDate" DESC, aggregate."createdAt" DESC
      LIMIT 1
    `;

    const latest = latestRows[0] ?? null;

    let correlationLabel = 'LOW_ATTENDANCE_LOW_SCORE';
    if (latest) {
      const attendanceForLatestExam = await this.getAttendanceSummary(
        studentId,
        context.tenantId,
        latest.startDate,
        latest.endDate,
      );

      const highAttendance = attendanceForLatestExam.percentage >= 75;
      const highScore = latest.percentage >= 60;

      if (highAttendance && highScore) {
        correlationLabel = 'HIGH_ATTENDANCE_HIGH_SCORE';
      } else if (highAttendance && !highScore) {
        correlationLabel = 'HIGH_ATTENDANCE_LOW_SCORE';
      } else if (!highAttendance && highScore) {
        correlationLabel = 'LOW_ATTENDANCE_HIGH_SCORE';
      }
    }

    return {
      studentProfile: {
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        status: student.status,
      },
      attendanceSummary,
      latestExamResult: latest
        ? {
            examId: latest.examId,
            examName: latest.examName,
            totalMarks: latest.totalMarks,
            percentage: latest.percentage,
            grade: latest.grade,
          }
        : null,
      rank: {
        classRank: latest?.classRank ?? null,
        sectionRank: latest?.sectionRank ?? null,
      },
      gpa: latest?.gpa ?? null,
      correlationLabel,
    };
  }

  private async getParentByUser(tenantId: string, userId: string): Promise<ParentEntity> {
    const rows = await this.prisma.$queryRaw<Array<ParentEntity>>`
      SELECT "id", "tenantId", "userId", "firstName", "lastName", "phone", "email", "relation"
      FROM "Parent"
      WHERE "tenantId" = ${tenantId}
        AND "userId" = ${userId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const parent = rows[0];
    if (!parent) {
      throw new ForbiddenException('Parent profile not found in tenant scope');
    }

    return parent;
  }

  private async assertMappedStudent(
    studentId: string,
    context: PortalRequestContext,
  ): Promise<{ id: string; admissionNumber: string; firstName: string; lastName: string; status: string }> {
    const parent = await this.getParentByUser(context.tenantId, context.user.sub);

    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      admissionNumber: string;
      firstName: string;
      lastName: string;
      status: string;
    }>>`
      SELECT student."id", student."admissionNumber", student."firstName", student."lastName", student."status"
      FROM "ParentStudentMapping" mapping
      INNER JOIN "Student" student
        ON student."id" = mapping."studentId"
       AND student."tenantId" = mapping."tenantId"
      WHERE mapping."tenantId" = ${context.tenantId}
        AND mapping."parentId" = ${parent.id}
        AND mapping."studentId" = ${studentId}
        AND mapping."softDelete" = false
        AND student."softDelete" = false
      LIMIT 1
    `;

    const student = rows[0];
    if (!student) {
      throw new NotFoundException('Student not found for parent mapping');
    }

    return student;
  }

  private async getAttendanceSummary(
    studentId: string,
    tenantId: string,
    from?: Date,
    to?: Date,
  ): Promise<{ totalDays: number; presentDays: number; absentDays: number; percentage: number }> {
    const conditions = [
      'ar."tenantId" = $1',
      'ar."studentId" = $2',
      'ar."softDelete" = false',
      'session."softDelete" = false',
    ];
    const params: unknown[] = [tenantId, studentId];

    if (from) {
      params.push(from);
      conditions.push(`session."date" >= $${params.length}::date`);
    }

    if (to) {
      params.push(to);
      conditions.push(`session."date" <= $${params.length}::date`);
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<{ status: string }>>(
      `
        SELECT ar."status"
        FROM "AttendanceRecord" ar
        INNER JOIN "AttendanceSession" session
          ON session."id" = ar."sessionId"
         AND session."tenantId" = ar."tenantId"
        WHERE ${conditions.join(' AND ')}
      `,
      ...params,
    );

    const totalDays = rows.length;
    const presentDays = rows.filter((row) => row.status === 'PRESENT' || row.status === 'LATE').length;
    const absentDays = rows.filter((row) => row.status === 'ABSENT' || row.status === 'EXCUSED').length;
    const percentage = totalDays === 0 ? 0 : Number(((presentDays / totalDays) * 100).toFixed(2));

    return {
      totalDays,
      presentDays,
      absentDays,
      percentage,
    };
  }

  private async publishAudit(
    context: PortalRequestContext,
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
      producer: { service: 'portal-service' },
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
