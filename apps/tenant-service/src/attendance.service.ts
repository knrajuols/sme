import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  EventEnvelope,
} from '@sme/common';
import type { JwtClaims } from '@sme/auth';
import { MessagePublisherService } from '@sme/messaging';

import { AttendanceSessionQueryDto } from './dto/attendance-session-query.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto';
import { PrismaService } from './prisma/prisma.service';

interface RequestContext {
  tenantId: string;
  user: JwtClaims;
  correlationId: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MessagePublisherService,
  ) {}

  async createSession(dto: CreateAttendanceSessionDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    await this.assertEntityExists('Section', dto.sectionId, context.tenantId);
    await this.assertEntityExists('AcademicYear', dto.academicYearId, context.tenantId);
    await this.assertTeacherOrAdmin(context, dto.classId, dto.sectionId);

    const duplicate = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "AttendanceSession"
      WHERE "tenantId" = ${context.tenantId}
        AND "date" = ${dto.date}
        AND "classId" = ${dto.classId}
        AND "sectionId" = ${dto.sectionId}
        AND "softDelete" = false
      LIMIT 1
    `;

    if (duplicate.length > 0) {
      throw new BadRequestException('Attendance session already exists for date/class/section');
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "AttendanceSession" (
        "id", "tenantId", "date", "classId", "sectionId", "academicYearId", "status",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.date}, ${dto.classId}, ${dto.sectionId}, ${dto.academicYearId}, 'OPEN',
        ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'AttendanceSession', id, 'Attendance session created', {
      date: dto.date.toISOString().slice(0, 10),
      classId: dto.classId,
      sectionId: dto.sectionId,
    });

    return { id };
  }

  async markAttendance(dto: CreateAttendanceRecordDto, context: RequestContext): Promise<{ recordCount: number }> {
    const session = await this.getSessionEntity(dto.sessionId, context.tenantId);
    await this.assertTeacherOrAdmin(context, session.classId, session.sectionId);

    if (session.status === 'CLOSED') {
      throw new BadRequestException('Cannot mark attendance for a closed session');
    }

    const enrollmentSet = new Set(
      (
        await this.prisma.$queryRaw<Array<{ studentId: string }>>`
          SELECT "studentId"
          FROM "StudentEnrollment"
          WHERE "tenantId" = ${context.tenantId}
            AND "classId" = ${session.classId}
            AND "sectionId" = ${session.sectionId}
            AND "academicYearId" = ${session.academicYearId}
            AND "softDelete" = false
        `
      ).map((item) => item.studentId),
    );

    for (const record of dto.records) {
      if (!enrollmentSet.has(record.studentId)) {
        throw new BadRequestException(`Student ${record.studentId} is not enrolled for this class/section/year`);
      }

      await this.prisma.$executeRaw`
        INSERT INTO "AttendanceRecord" (
          "id", "tenantId", "sessionId", "studentId", "status", "remarks",
          "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${context.tenantId}, ${session.id}, ${record.studentId}, ${record.status}, ${record.remarks ?? null},
          ${context.user.sub}, ${context.user.sub}, false, ${new Date()}, ${new Date()}
        )
        ON CONFLICT ("tenantId", "sessionId", "studentId") DO UPDATE SET
          "status" = EXCLUDED."status",
          "remarks" = EXCLUDED."remarks",
          "updatedBy" = EXCLUDED."updatedBy",
          "updatedAt" = EXCLUDED."updatedAt"
      `;
    }

    await this.publishAudit(context, 'MARK', 'AttendanceRecord', session.id, 'Attendance marked', {
      sessionId: session.id,
      recordCount: dto.records.length,
    });

    return { recordCount: dto.records.length };
  }

  async closeSession(id: string, context: RequestContext): Promise<{ id: string; status: string }> {
    const session = await this.getSessionEntity(id, context.tenantId);
    await this.assertTeacherOrAdmin(context, session.classId, session.sectionId);

    if (session.status === 'CLOSED') {
      return { id: session.id, status: session.status };
    }

    await this.prisma.$executeRaw`
      UPDATE "AttendanceSession"
      SET "status" = 'CLOSED', "updatedBy" = ${context.user.sub}, "updatedAt" = ${new Date()}
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId} AND "softDelete" = false
    `;

    await this.publishAudit(context, 'CLOSE', 'AttendanceSession', id, 'Attendance session closed');
    return { id, status: 'CLOSED' };
  }

  async getSessionById(id: string, tenantId: string): Promise<{
    id: string;
    date: Date;
    classId: string;
    sectionId: string;
    academicYearId: string;
    status: string;
    records: Array<{ studentId: string; status: string; remarks: string | null }>;
    enrolledStudentIds: string[];
  }> {
    const session = await this.getSessionEntity(id, tenantId);

    const records = await this.prisma.$queryRaw<Array<{ studentId: string; status: string; remarks: string | null }>>`
      SELECT "studentId", "status", "remarks"
      FROM "AttendanceRecord"
      WHERE "tenantId" = ${tenantId}
        AND "sessionId" = ${id}
        AND "softDelete" = false
      ORDER BY "createdAt" ASC
    `;

    const enrolledStudentIds = (
      await this.prisma.$queryRaw<Array<{ studentId: string }>>`
        SELECT "studentId"
        FROM "StudentEnrollment"
        WHERE "tenantId" = ${tenantId}
          AND "classId" = ${session.classId}
          AND "sectionId" = ${session.sectionId}
          AND "academicYearId" = ${session.academicYearId}
          AND "softDelete" = false
        ORDER BY "createdAt" ASC
      `
    ).map((item) => item.studentId);

    return {
      id: session.id,
      date: session.date,
      classId: session.classId,
      sectionId: session.sectionId,
      academicYearId: session.academicYearId,
      status: session.status,
      records,
      enrolledStudentIds,
    };
  }

  async listSessions(query: AttendanceSessionQueryDto, tenantId: string): Promise<Array<{
    id: string;
    date: Date;
    classId: string;
    sectionId: string;
    academicYearId: string;
    status: string;
  }>> {
    const conditions: string[] = ['"tenantId" = $1', '"softDelete" = false'];
    const params: unknown[] = [tenantId];

    if (query.date) {
      params.push(query.date);
      conditions.push(`"date" = $${params.length}`);
    }

    if (query.classId) {
      params.push(query.classId);
      conditions.push(`"classId" = $${params.length}`);
    }

    if (query.sectionId) {
      params.push(query.sectionId);
      conditions.push(`"sectionId" = $${params.length}`);
    }

    return this.prisma.$queryRawUnsafe<Array<{
      id: string;
      date: Date;
      classId: string;
      sectionId: string;
      academicYearId: string;
      status: string;
    }>>(
      `SELECT "id", "date", "classId", "sectionId", "academicYearId", "status"
       FROM "AttendanceSession"
       WHERE ${conditions.join(' AND ')}
       ORDER BY "date" DESC, "createdAt" DESC`,
      ...params,
    );
  }

  async getStudentSummary(
    studentId: string,
    query: AttendanceSummaryQueryDto,
    tenantId: string,
  ): Promise<{ totalDays: number; presentDays: number; absentDays: number; percentage: number }> {
    await this.assertEntityExists('Student', studentId, tenantId);

    const rows = await this.prisma.$queryRaw<Array<{ status: string }>>`
      SELECT ar."status"
      FROM "AttendanceRecord" ar
      INNER JOIN "AttendanceSession" s
        ON s."id" = ar."sessionId"
       AND s."tenantId" = ar."tenantId"
      WHERE ar."tenantId" = ${tenantId}
        AND ar."studentId" = ${studentId}
        AND ar."softDelete" = false
        AND s."softDelete" = false
        AND s."date" >= ${query.from}::date
        AND s."date" <= ${query.to}::date
    `;

    const totalDays = rows.length;
    const presentDays = rows.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const absentDays = rows.filter((r) => r.status === 'ABSENT' || r.status === 'EXCUSED').length;
    const rawPercentage = totalDays === 0 ? 0 : (presentDays / totalDays) * 100;
    const percentage = Number(rawPercentage.toFixed(2));

    return {
      totalDays,
      presentDays,
      absentDays,
      percentage,
    };
  }

  private async getSessionEntity(
    id: string,
    tenantId: string,
  ): Promise<{ id: string; classId: string; sectionId: string; academicYearId: string; status: string; date: Date }> {
    const sessions = await this.prisma.$queryRaw<Array<{
      id: string;
      classId: string;
      sectionId: string;
      academicYearId: string;
      status: string;
      date: Date;
    }>>`
      SELECT "id", "classId", "sectionId", "academicYearId", "status", "date"
      FROM "AttendanceSession"
      WHERE "id" = ${id}
        AND "tenantId" = ${tenantId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const session = sessions[0];
    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    return session;
  }

  private async assertTeacherOrAdmin(
    context: RequestContext,
    classId: string,
    sectionId: string,
  ): Promise<void> {
    const roles = context.user.roles;
    if (roles.includes('SCHOOL_ADMIN') || roles.includes('PLATFORM_ADMIN')) {
      return;
    }

    const teacherRows = await this.prisma.$queryRaw<Array<{ teacherId: string }>>`
      SELECT t."id" as "teacherId"
      FROM "Teacher" t
      WHERE t."tenantId" = ${context.tenantId}
        AND t."userId" = ${context.user.sub}
        AND t."softDelete" = false
      LIMIT 1
    `;

    const teacherId = teacherRows[0]?.teacherId;
    if (!teacherId) {
      throw new ForbiddenException('Only assigned teacher or SCHOOL_ADMIN can perform attendance operations');
    }

    const assignment = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ClassTeacherAssignment"
      WHERE "tenantId" = ${context.tenantId}
        AND "classId" = ${classId}
        AND "sectionId" = ${sectionId}
        AND "teacherId" = ${teacherId}
        AND "softDelete" = false
      LIMIT 1
    `;

    if (assignment.length === 0) {
      throw new ForbiddenException('Only assigned teacher or SCHOOL_ADMIN can perform attendance operations');
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