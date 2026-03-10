import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  EventEnvelope,
} from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';

import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateStudentEnrollmentDto } from './dto/create-student-enrollment.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { PrismaService } from './prisma/prisma.service';

interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  correlationId: string;
}

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MessagePublisherService,
  ) {}

  async createAcademicYear(dto: CreateAcademicYearDto, context: RequestContext): Promise<{ id: string }> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "AcademicYear" (
        "id", "tenantId", "name", "startDate", "endDate", "isActive",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.name}, ${dto.startDate}, ${dto.endDate}, ${dto.isActive},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'AcademicYear', id, 'Academic year created', { name: dto.name });
    return { id };
  }

  async createClass(dto: CreateClassDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('AcademicYear', dto.academicYearId, context.tenantId);

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Class" (
        "id", "tenantId", "name", "code", "academicYearId",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.name}, ${dto.code}, ${dto.academicYearId},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'Class', id, 'Class created', { code: dto.code });
    return { id };
  }

  async createSection(dto: CreateSectionDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('Class', dto.classId, context.tenantId);

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Section" (
        "id", "tenantId", "name", "classId",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.name}, ${dto.classId},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'Section', id, 'Section created', { name: dto.name });
    return { id };
  }

  async createSubject(dto: CreateSubjectDto, context: RequestContext): Promise<{ id: string }> {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Subject" (
        "id", "tenantId", "name", "code",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.name}, ${dto.code},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'Subject', id, 'Subject created', { code: dto.code });
    return { id };
  }

  async createStudent(dto: CreateStudentDto, context: RequestContext): Promise<{ id: string }> {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Student" (
        "id", "tenantId", "admissionNumber", "firstName", "lastName", "dateOfBirth", "gender", "status",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.admissionNumber}, ${dto.firstName}, ${dto.lastName}, ${dto.dateOfBirth}, ${dto.gender}, ${dto.status},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'Student', id, 'Student created', { admissionNumber: dto.admissionNumber });
    return { id };
  }

  async createTeacher(dto: CreateTeacherDto, context: RequestContext): Promise<{ id: string }> {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Teacher" (
        "id", "tenantId", "userId", "employeeCode", "designation",
        "firstName", "lastName", "email", "contactPhone", "isActive",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.userId ?? null}, ${dto.employeeCode}, ${dto.designation},
        ${dto.firstName}, ${dto.lastName}, ${dto.email}, ${dto.phone ?? null}, ${dto.isActive ?? true},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'Teacher', id, 'Teacher created', { employeeCode: dto.employeeCode });
    return { id };
  }

  async listTeachers(tenantId: string): Promise<Array<{
    id: string; firstName: string | null; lastName: string | null; email: string | null;
    contactPhone: string | null; employeeCode: string; designation: string;
    isActive: boolean; createdAt: Date; updatedAt: Date;
  }>> {
    return this.prisma.$queryRaw<Array<{
      id: string; firstName: string | null; lastName: string | null; email: string | null;
      contactPhone: string | null; employeeCode: string; designation: string;
      isActive: boolean; createdAt: Date; updatedAt: Date;
    }>>`
      SELECT "id", "firstName", "lastName", "email", "contactPhone",
             "employeeCode", "designation", "isActive", "createdAt", "updatedAt"
      FROM "Teacher"
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      ORDER BY "lastName" ASC, "firstName" ASC
    `;
  }

  async updateTeacher(id: string, dto: UpdateTeacherDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.teacher.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { contactPhone: dto.phone }),
        ...(dto.employeeCode !== undefined && { employeeCode: dto.employeeCode }),
        ...(dto.designation !== undefined && { designation: dto.designation }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-FAC-4041] Teacher not found');

    await this.publishAudit(context, 'UPDATE', 'Teacher', id, 'Teacher updated', { ...dto });
    return { updated: true };
  }

  async deleteTeacher(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Teacher"
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId} AND "softDelete" = false
      LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('[ERR-FAC-4042] Teacher not found');

    await this.prisma.$executeRaw`
      UPDATE "Teacher" SET "softDelete" = true, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
    `;

    await this.publishAudit(context, 'DELETE', 'Teacher', id, 'Teacher soft-deleted', {});
    return { deleted: true };
  }

  async assignClassTeacher(dto: AssignClassTeacherDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    await this.assertEntityExists('Section', dto.sectionId, context.tenantId);
    await this.assertEntityExists('Teacher', dto.teacherId, context.tenantId);

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "ClassTeacherAssignment" (
        "id", "tenantId", "classId", "sectionId", "teacherId",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.classId}, ${dto.sectionId}, ${dto.teacherId},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'ASSIGN_TEACHER', 'ClassTeacherAssignment', id, 'Class teacher assigned', {
      classId: dto.classId,
      sectionId: dto.sectionId,
      teacherId: dto.teacherId,
    });
    return { id };
  }

  async enrollStudent(dto: CreateStudentEnrollmentDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('Student', dto.studentId, context.tenantId);
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    await this.assertEntityExists('Section', dto.sectionId, context.tenantId);
    await this.assertEntityExists('AcademicYear', dto.academicYearId, context.tenantId);

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "StudentEnrollment" (
        "id", "tenantId", "studentId", "classId", "sectionId", "academicYearId", "rollNumber",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.studentId}, ${dto.classId}, ${dto.sectionId}, ${dto.academicYearId}, ${dto.rollNumber},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'ENROLL', 'StudentEnrollment', id, 'Student enrolled', {
      studentId: dto.studentId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      academicYearId: dto.academicYearId,
      rollNumber: dto.rollNumber,
    });
    return { id };
  }

  // ── Academic Year READ / UPDATE / DELETE ───────────────────────────────────

  async listAcademicYears(tenantId: string): Promise<Array<{
    id: string; name: string; startDate: Date; endDate: Date; isActive: boolean; createdAt: Date; updatedAt: Date;
  }>> {
    return this.prisma.$queryRaw<Array<{
      id: string; name: string; startDate: Date; endDate: Date; isActive: boolean; createdAt: Date; updatedAt: Date;
    }>>`
      SELECT "id", "name", "startDate", "endDate", "isActive", "createdAt", "updatedAt"
      FROM "AcademicYear"
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      ORDER BY "startDate" DESC
    `;
  }

  async updateAcademicYear(id: string, dto: UpdateAcademicYearDto, context: RequestContext): Promise<{ updated: boolean }> {
    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new BadRequestException('[ERR-ACAD-YEAR-4001] startDate must be before endDate');
    }

    const result = await this.prisma.academicYear.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-ACAD-YEAR-4041] Academic year not found');

    await this.publishAudit(context, 'UPDATE', 'AcademicYear', id, 'Academic year updated', { ...dto });
    return { updated: true };
  }

  async deleteAcademicYear(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT "id", "isActive" FROM "AcademicYear"
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId} AND "softDelete" = false
      LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('[ERR-ACAD-YEAR-4042] Academic year not found');
    if (rows[0].isActive) throw new BadRequestException('[ERR-ACAD-YEAR-4002] Cannot delete an active academic year');

    await this.prisma.$executeRaw`
      UPDATE "AcademicYear" SET "softDelete" = true, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
    `;

    await this.publishAudit(context, 'DELETE', 'AcademicYear', id, 'Academic year soft-deleted', {});
    return { deleted: true };
  }

  // ── Class READ / UPDATE / DELETE ─────────────────────────────────────────────

  async listClasses(tenantId: string, academicYearId?: string): Promise<Array<{
    id: string; name: string; code: string; academicYearId: string; createdAt: Date; updatedAt: Date;
  }>> {
    if (academicYearId) {
      return this.prisma.$queryRaw<Array<{
        id: string; name: string; code: string; academicYearId: string; createdAt: Date; updatedAt: Date;
      }>>`
        SELECT "id", "name", "code", "academicYearId", "createdAt", "updatedAt"
        FROM "Class"
        WHERE "tenantId" = ${tenantId}
          AND "academicYearId" = ${academicYearId}
          AND "softDelete" = false
        ORDER BY "name" ASC
      `;
    }
    return this.prisma.$queryRaw<Array<{
      id: string; name: string; code: string; academicYearId: string; createdAt: Date; updatedAt: Date;
    }>>`
      SELECT "id", "name", "code", "academicYearId", "createdAt", "updatedAt"
      FROM "Class"
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      ORDER BY "name" ASC
    `;
  }

  async updateClass(id: string, dto: UpdateClassDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.class.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-ACAD-CLS-4041] Class not found');

    await this.publishAudit(context, 'UPDATE', 'Class', id, 'Class updated', { ...dto });
    return { updated: true };
  }

  async deleteClass(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Class"
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId} AND "softDelete" = false
      LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('[ERR-ACAD-CLS-4042] Class not found');

    await this.prisma.$executeRaw`
      UPDATE "Class" SET "softDelete" = true, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
    `;

    await this.publishAudit(context, 'DELETE', 'Class', id, 'Class soft-deleted', {});
    return { deleted: true };
  }

  // ── Section READ / UPDATE / DELETE ──────────────────────────────────────────

  async listSections(tenantId: string, classId?: string): Promise<Array<{
    id: string; name: string; classId: string; className: string; createdAt: Date; updatedAt: Date;
  }>> {
    if (classId) {
      return this.prisma.$queryRaw<Array<{
        id: string; name: string; classId: string; className: string; createdAt: Date; updatedAt: Date;
      }>>`
        SELECT s."id", s."name", s."classId", c."name" AS "className", s."createdAt", s."updatedAt"
        FROM "Section" s
        JOIN "Class" c ON c."id" = s."classId"
        WHERE s."tenantId" = ${tenantId} AND s."classId" = ${classId} AND s."softDelete" = false
        ORDER BY c."name" ASC, s."name" ASC
      `;
    }
    return this.prisma.$queryRaw<Array<{
      id: string; name: string; classId: string; className: string; createdAt: Date; updatedAt: Date;
    }>>`
      SELECT s."id", s."name", s."classId", c."name" AS "className", s."createdAt", s."updatedAt"
      FROM "Section" s
      JOIN "Class" c ON c."id" = s."classId"
      WHERE s."tenantId" = ${tenantId} AND s."softDelete" = false
      ORDER BY c."name" ASC, s."name" ASC
    `;
  }

  async updateSection(id: string, dto: UpdateSectionDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.section.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-ACAD-SEC-4041] Section not found');

    await this.publishAudit(context, 'UPDATE', 'Section', id, 'Section updated', { ...dto });
    return { updated: true };
  }

  async deleteSection(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Section"
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId} AND "softDelete" = false
      LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('[ERR-ACAD-SEC-4042] Section not found');

    await this.prisma.$executeRaw`
      UPDATE "Section" SET "softDelete" = true, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
    `;

    await this.publishAudit(context, 'DELETE', 'Section', id, 'Section soft-deleted', {});
    return { deleted: true };
  }

  // ── Subject READ / UPDATE / DELETE ──────────────────────────────────────────

  async listSubjects(tenantId: string): Promise<Array<{
    id: string; name: string; code: string; createdAt: Date; updatedAt: Date;
  }>> {
    return this.prisma.$queryRaw<Array<{
      id: string; name: string; code: string; createdAt: Date; updatedAt: Date;
    }>>`
      SELECT "id", "name", "code", "createdAt", "updatedAt"
      FROM "Subject"
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      ORDER BY "name" ASC
    `;
  }

  async updateSubject(id: string, dto: UpdateSubjectDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.subject.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-ACAD-SUBJ-4041] Subject not found');

    await this.publishAudit(context, 'UPDATE', 'Subject', id, 'Subject updated', { ...dto });
    return { updated: true };
  }

  async deleteSubject(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Subject"
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId} AND "softDelete" = false
      LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('[ERR-ACAD-SUBJ-4042] Subject not found');

    await this.prisma.$executeRaw`
      UPDATE "Subject" SET "softDelete" = true, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
    `;

    await this.publishAudit(context, 'DELETE', 'Subject', id, 'Subject soft-deleted', {});
    return { deleted: true };
  }

  private async assertEntityExists(tableName: string, id: string, tenantId: string): Promise<void> {
    const safeRows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "${tableName}" WHERE "id" = $1 AND "tenantId" = $2 AND "softDelete" = false LIMIT 1`,
      id,
      tenantId,
    );

    if (safeRows.length === 0) {
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
        actorId: context.userId,
        role: context.role,
      },
      payload,
    };

    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, envelope);
  }
}