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
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateStudentEnrollmentDto } from './dto/create-student-enrollment.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
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
    await this.assertEntityExists('Class', dto.classId, context.tenantId);

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Subject" (
        "id", "tenantId", "name", "code", "classId",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.name}, ${dto.code}, ${dto.classId},
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
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${dto.userId}, ${dto.employeeCode}, ${dto.designation},
        ${context.userId}, ${context.userId}, false, ${new Date()}, ${new Date()}
      )
    `;

    await this.publishAudit(context, 'CREATE', 'Teacher', id, 'Teacher created', { employeeCode: dto.employeeCode });
    return { id };
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