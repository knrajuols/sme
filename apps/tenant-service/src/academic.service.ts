import {
  BadRequestException,
  ConflictException,
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
import { AssignTeacherSubjectsDto } from './dto/assign-teacher-subjects.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateParentDto } from './dto/create-parent.dto';
import { CreateParentStudentMappingDto } from './dto/create-parent-student-mapping.dto';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateClassTeacherAssignmentDto } from './dto/update-class-teacher-assignment.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { NamingStyle } from './dto/seed-sections.dto';
import { CreateStudentEnrollmentDto } from './dto/create-student-enrollment.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentEnrollmentDto } from './dto/update-student-enrollment.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { BulkAttendanceDto } from './dto/create-bulk-attendance.dto';
import { BulkMarksDto } from './dto/create-bulk-marks.dto';
import { CreateGradeScaleDto } from './dto/create-grade-scale.dto';
import { UpdateGradeScaleDto } from './dto/update-grade-scale.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { CreateExamSubjectDto } from './dto/create-exam-subject.dto';
import { UpdateExamSubjectDto } from './dto/update-exam-subject.dto';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { UpdateExamScheduleDto } from './dto/update-exam-schedule.dto';
import { TenantStatus } from './generated/prisma-client';
import { PrismaService } from './prisma/prisma.service';
import { addMins, timeToMins } from './utils/time.util';

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

    const { id } = await this.prisma.academicYear.create({
      data: {
        tenantId: context.tenantId,
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: dto.isActive ?? false,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'CREATE', 'AcademicYear', id, 'Academic year created', { name: dto.name });
    return { id };
  }

  async createClass(dto: CreateClassDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('AcademicYear', dto.academicYearId, context.tenantId);

    const { id } = await this.prisma.class.create({
      data: {
        tenantId: context.tenantId,
        name: dto.name,
        code: dto.code,
        academicYearId: dto.academicYearId,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'CREATE', 'Class', id, 'Class created', { code: dto.code });
    return { id };
  }

  async createSection(dto: CreateSectionDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('Class', dto.classId, context.tenantId);

    const { id } = await this.prisma.section.create({
      data: {
        tenantId: context.tenantId,
        name: dto.name,
        classId: dto.classId,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'CREATE', 'Section', id, 'Section created', { name: dto.name });
    return { id };
  }

  async createSubject(dto: CreateSubjectDto, context: RequestContext): Promise<{ id: string }> {
    const { id } = await this.prisma.subject.create({
      data: {
        tenantId: context.tenantId,
        name: dto.name,
        code: dto.code,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'CREATE', 'Subject', id, 'Subject created', { code: dto.code });
    return { id };
  }

  async createStudent(dto: CreateStudentDto, context: RequestContext): Promise<{ id: string }> {
    // Validate parents up-front (outside the transaction) so we fail fast with a clear error.
    if (dto.parentIds?.length) {
      const validParents = await this.prisma.parent.findMany({
        where: { id: { in: dto.parentIds }, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (validParents.length !== dto.parentIds.length) {
        throw new BadRequestException(
          '[ERR-PSM-4001] One or more parentIds do not exist or do not belong to this tenant',
        );
      }
    }

    // Atomic transaction: student row + parent mappings succeed or fail together.
    const { id } = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          tenantId: context.tenantId,
          admissionNumber: dto.admissionNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth,
          gender: dto.gender as any,
          status: dto.status as any,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        select: { id: true },
      });

      if (dto.parentIds?.length) {
        await tx.parentStudentMapping.createMany({
          data: dto.parentIds.map((parentId) => ({
            tenantId: context.tenantId,
            parentId,
            studentId: student.id,
            createdBy: context.userId,
            updatedBy: context.userId,
          })),
        });
      }

      return student;
    });

    await this.publishAudit(context, 'CREATE', 'Student', id, 'Student created', { admissionNumber: dto.admissionNumber });
    return { id };
  }

  async createTeacher(dto: CreateTeacherDto, context: RequestContext): Promise<{ id: string }> {
    // Validate subjects up-front (outside the transaction) so we fail fast with a clear error.
    if (dto.subjectIds?.length) {
      const validSubjects = await this.prisma.subject.findMany({
        where: { id: { in: dto.subjectIds }, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (validSubjects.length !== dto.subjectIds.length) {
        throw new BadRequestException(
          '[ERR-TS-4001] One or more subjectIds do not exist or do not belong to this tenant',
        );
      }
    }

    const id = randomUUID();

    // Single atomic transaction: teacher row + subject assignments succeed or fail together.
    await this.prisma.$transaction(async (tx) => {
      await tx.teacher.create({
        data: {
          id,
          tenantId: context.tenantId,
          userId: dto.userId ?? undefined,
          employeeCode: dto.employeeCode,
          designation: dto.designation,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          contactPhone: dto.phone ?? undefined,
          isActive: dto.isActive ?? true,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
      });

      if (dto.subjectIds?.length) {
        await tx.teacherSubject.createMany({
          data: dto.subjectIds.map((subjectId) => ({
            tenantId: context.tenantId,
            teacherId: id,
            subjectId,
            createdBy: context.userId,
          })),
        });
      }
    });

    await this.publishAudit(context, 'CREATE', 'Teacher', id, 'Teacher created', { employeeCode: dto.employeeCode });
    return { id };
  }

  async listTeachers(tenantId: string): Promise<Array<{
    id: string; firstName: string | null; lastName: string | null; email: string | null;
    contactPhone: string | null; employeeCode: string; designation: string;
    isActive: boolean; createdAt: Date; updatedAt: Date;
    subjects: { id: string; name: string; code: string; }[];
  }>> {
    const rows = await this.prisma.teacher.findMany({
      where: { tenantId, softDelete: false },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        contactPhone: true, employeeCode: true, designation: true,
        isActive: true, createdAt: true, updatedAt: true,
        teacherSubjects: {
          where: { subject: { softDelete: false } },
          select: { subject: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return rows.map(({ teacherSubjects, ...rest }) => ({
      ...rest,
      subjects: teacherSubjects.map(ts => ts.subject),
    }));
  }

  async updateTeacher(id: string, dto: UpdateTeacherDto, context: RequestContext): Promise<{ updated: boolean }> {
    // Validate subjects up-front (outside the transaction) so we fail fast with a clear error.
    if (dto.subjectIds !== undefined && dto.subjectIds.length > 0) {
      const validSubjects = await this.prisma.subject.findMany({
        where: { id: { in: dto.subjectIds }, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (validSubjects.length !== dto.subjectIds.length) {
        throw new BadRequestException(
          '[ERR-TS-4001] One or more subjectIds do not exist or do not belong to this tenant',
        );
      }
    }

    // Single atomic transaction: teacher update + subject replacement succeed or fail together.
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.teacher.updateMany({
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

      // When subjectIds is explicitly provided (even as []), atomically replace all assignments.
      if (dto.subjectIds !== undefined) {
        await tx.teacherSubject.deleteMany({
          where: { teacherId: id, tenantId: context.tenantId },
        });
        if (dto.subjectIds.length > 0) {
          await tx.teacherSubject.createMany({
            data: dto.subjectIds.map((subjectId) => ({
              tenantId: context.tenantId,
              teacherId: id,
              subjectId,
              createdBy: context.userId,
            })),
          });
        }
      }
    });

    await this.publishAudit(context, 'UPDATE', 'Teacher', id, 'Teacher updated', { ...dto });
    return { updated: true };
  }

  async deleteTeacher(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('[ERR-FAC-4042] Teacher not found');

    await this.prisma.teacher.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'Teacher', id, 'Teacher soft-deleted', {});
    return { deleted: true };
  }

  async assignClassTeacher(dto: AssignClassTeacherDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    await this.assertEntityExists('Section', dto.sectionId, context.tenantId);
    await this.assertEntityExists('Teacher', dto.teacherId, context.tenantId);

    const { id } = await this.prisma.classTeacherAssignment.create({
      data: {
        tenantId: context.tenantId,
        classId: dto.classId,
        sectionId: dto.sectionId,
        teacherId: dto.teacherId,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

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

    const { id } = await this.prisma.studentEnrollment.create({
      data: {
        tenantId: context.tenantId,
        studentId: dto.studentId,
        classId: dto.classId,
        sectionId: dto.sectionId,
        academicYearId: dto.academicYearId,
        rollNumber: dto.rollNumber,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'ENROLL', 'StudentEnrollment', id, 'Student enrolled', {
      studentId: dto.studentId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      academicYearId: dto.academicYearId,
      rollNumber: dto.rollNumber,
    });
    return { id };
  }

  // â”€â”€ Academic Year READ / UPDATE / DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const year = await this.prisma.academicYear.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: {
        id: true,
        isActive: true,
        _count: {
          select: {
            classes:            true,
            studentEnrollments: true,
            periods:            true,
            attendanceSessions: true,
            exams:              true,
            feeStructures:      true,
            classTimetables:    true,
          },
        },
      },
    });
    if (!year) throw new NotFoundException('[ERR-ACAD-YEAR-4042] Academic year not found');
    if (year.isActive) throw new BadRequestException('[ERR-ACAD-YEAR-4002] Cannot delete an active academic year');

    // Dependency check: block deletion when any relational data is attached.
    const linkedCount =
      year._count.classes +
      year._count.studentEnrollments +
      year._count.periods +
      year._count.attendanceSessions +
      year._count.exams +
      year._count.feeStructures +
      year._count.classTimetables;

    if (linkedCount > 0) {
      throw new BadRequestException(
        'Cannot delete an Academic Year that has linked data. Please change its status to COMPLETED instead.',
      );
    }

    // No dependents â€” hard delete to keep the DB clean and avoid unique-constraint zombies.
    await this.prisma.academicYear.delete({
      where: { id },
    });

    await this.publishAudit(context, 'DELETE', 'AcademicYear', id, 'Academic year hard-deleted', {});
    return { deleted: true };
  }

  async seedAcademicYears(context: RequestContext): Promise<{ seeded: number }> {
    // â”€â”€ Task 2A: Zombie cleanup â€” hard-delete any soft-deleted rows for this tenant
    // so their (tenantId, name) slots are completely free for the new seed records.
    await this.prisma.academicYear.deleteMany({
      where: { tenantId: context.tenantId, softDelete: true },
    });

    // â”€â”€ Backend idempotency guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existing = await this.prisma.academicYear.count({
      where: { tenantId: context.tenantId, softDelete: false },
    });
    if (existing > 0) {
      throw new ConflictException('Academic years already exist for this school.');
    }

    // â”€â”€ Build clean April-to-March school calendar boundaries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const y = new Date().getFullYear();

    // Helper: midnight on the first day of a month, expressed as a UTC Date so
    // the value is timezone-agnostic and deterministic across all environments.
    const utcDate = (year: number, month: number, day: number): Date =>
      new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    const seeds = [
      {
        id:        randomUUID(),
        tenantId:  context.tenantId,
        name:      `${y - 1}-${y}`,
        startDate: utcDate(y - 1, 4, 1),
        endDate:   utcDate(y,     3, 31),
        isActive:  false,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      {
        id:        randomUUID(),
        tenantId:  context.tenantId,
        name:      `${y}-${y + 1}`,
        startDate: utcDate(y,     4, 1),
        endDate:   utcDate(y + 1, 3, 31),
        isActive:  true,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      {
        id:        randomUUID(),
        tenantId:  context.tenantId,
        name:      `${y + 1}-${y + 2}`,
        startDate: utcDate(y + 1, 4, 1),
        endDate:   utcDate(y + 2, 3, 31),
        isActive:  false,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
    ];

    const result = await this.prisma.academicYear.createMany({
      data: seeds,
      skipDuplicates: true,
    });

    await this.publishAudit(
      context,
      'SEED',
      'AcademicYear',
      context.tenantId,
      'Academic years seeded for onboarding',
      { count: result.count },
    );

    return { seeded: result.count };
  }

  // â”€â”€ Class READ / UPDATE / DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async seedClasses(context: RequestContext): Promise<{ seeded: number }> {
    // â”€â”€ Step 1: Identify the active academic year â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: context.tenantId, isActive: true, softDelete: false },
      select: { id: true, name: true },
    });
    if (!activeYear) {
      throw new BadRequestException(
        'No active Academic Year found. Please seed Academic Years first before seeding Classes.',
      );
    }

    // â”€â”€ Step 2: Zombie cleanup â€” hard-delete soft-deleted class rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await this.prisma.class.deleteMany({
      where: { tenantId: context.tenantId, softDelete: true },
    });

    // â”€â”€ Step 3: Idempotency guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existing = await this.prisma.class.count({
      where: { tenantId: context.tenantId, softDelete: false },
    });
    if (existing > 0) {
      throw new ConflictException('Classes already exist for this school.');
    }

    // â”€â”€ Step 4: Build 12 class records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const seeds = Array.from({ length: 12 }, (_, i) => ({
      id:            randomUUID(),
      tenantId:      context.tenantId,
      name:          `Class ${i + 1}`,
      code:          `C${i + 1}`,
      academicYearId: activeYear.id,
      createdBy:     context.userId,
      updatedBy:     context.userId,
    }));

    // â”€â”€ Step 5: Atomic creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const result = await this.prisma.$transaction(async (tx) => {
      return tx.class.createMany({ data: seeds, skipDuplicates: true });
    });

    await this.publishAudit(
      context,
      'SEED',
      'Class',
      context.tenantId,
      `Seeded 12 classes for academic year ${activeYear.name}`,
      { count: result.count, academicYearId: activeYear.id },
    );

    return { seeded: result.count };
  }

  // â”€â”€ Section Seeder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async seedSections(
    context: RequestContext,
    namingStyle: NamingStyle,
  ): Promise<{ seeded: number }> {
    // Step 1: Zombie cleanup â€” hard-delete soft-deleted pool sections (no classId)
    await this.prisma.$executeRaw`
      DELETE FROM "Section"
      WHERE "tenantId" = ${context.tenantId}
        AND "classId" IS NULL
        AND "softDelete" = true
    `;

    // Step 2: Idempotency guard â€” abort if active pool sections already exist
    const [{ count }] = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Section"
      WHERE "tenantId" = ${context.tenantId}
        AND "classId" IS NULL
        AND "softDelete" = false
    `;
    if (count > 0n) {
      throw new ConflictException(
        'Section pool already exists for this school. Remove all pool sections before re-seeding.',
      );
    }

    // Step 3: Build name list based on chosen style
    const ALPHABETIC_NAMES = ['A','B','C','D','E','F','G','H','I','J'].map((l) => `Section ${l}`);
    const THEMATIC_NAMES = [
      'Rama','Krishna','Cauvery','Ganga','Yamuna',
      'Godavari','Narmada','Indus','Saraswati','Brahmaputra',
    ];
    const names = namingStyle === NamingStyle.ALPHABETIC ? ALPHABETIC_NAMES : THEMATIC_NAMES;

    // Step 4: Atomic insertion â€” sections are NOT linked to any class at this stage
    let seeded = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const name of names) {
        const id = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "Section" ("id", "tenantId", "name", "classId", "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt")
          VALUES (${id}, ${context.tenantId}, ${name}, NULL, ${context.userId}, ${context.userId}, false, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `;
        seeded++;
      }
    });

    await this.publishAudit(
      context,
      'SEED',
      'Section',
      context.tenantId,
      `Seeded ${seeded} sections (${namingStyle}) â€” no class associations`,
      { count: seeded, namingStyle },
    );

    return { seeded };
  }

  async listClasses(tenantId: string, academicYearId?: string): Promise<Array<{
    id: string; name: string; code: string; academicYearId: string; createdAt: Date; updatedAt: Date;
  }>> {
    type ClassRow = { id: string; name: string; code: string; academicYearId: string; createdAt: Date; updatedAt: Date };

    let rows: ClassRow[];
    if (academicYearId) {
      rows = await this.prisma.$queryRaw<ClassRow[]>`
        SELECT "id", "name", "code", "academicYearId", "createdAt", "updatedAt"
        FROM "Class"
        WHERE "tenantId" = ${tenantId}
          AND "academicYearId" = ${academicYearId}
          AND "softDelete" = false
      `;
    } else {
      rows = await this.prisma.$queryRaw<ClassRow[]>`
        SELECT "id", "name", "code", "academicYearId", "createdAt", "updatedAt"
        FROM "Class"
        WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      `;
    }

    // Natural numeric sort: ensures "Class 2" < "Class 10" < "Class 12"
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return rows.sort((a, b) => collator.compare(a.name, b.name));
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
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('[ERR-ACAD-CLS-4042] Class not found');

    await this.prisma.class.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'Class', id, 'Class soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ Section READ / UPDATE / DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listSections(tenantId: string, classId?: string): Promise<Array<{
    id: string; name: string; classId: string | null; className: string | null; createdAt: Date; updatedAt: Date;
  }>> {
    if (classId) {
      return this.prisma.$queryRaw<Array<{
        id: string; name: string; classId: string | null; className: string | null; createdAt: Date; updatedAt: Date;
      }>>`
        SELECT s."id", s."name", s."classId", c."name" AS "className", s."createdAt", s."updatedAt"
        FROM "Section" s
        LEFT JOIN "Class" c ON c."id" = s."classId"
        WHERE s."tenantId" = ${tenantId} AND s."classId" = ${classId} AND s."softDelete" = false
        ORDER BY c."name" ASC, s."name" ASC
      `;
    }
    return this.prisma.$queryRaw<Array<{
      id: string; name: string; classId: string | null; className: string | null; createdAt: Date; updatedAt: Date;
    }>>`
      SELECT s."id", s."name", s."classId", c."name" AS "className", s."createdAt", s."updatedAt"
      FROM "Section" s
      LEFT JOIN "Class" c ON c."id" = s."classId"
      WHERE s."tenantId" = ${tenantId} AND s."softDelete" = false
      ORDER BY COALESCE(c."name", '~~~') ASC, s."name" ASC
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
    const section = await this.prisma.section.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!section) throw new NotFoundException('[ERR-ACAD-SEC-4042] Section not found');

    await this.prisma.section.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'Section', id, 'Section soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ Subject READ / UPDATE / DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listSubjects(tenantId: string): Promise<Array<{
    id: string; name: string; code: string; status: string; createdAt: Date; updatedAt: Date;
  }>> {
    return this.prisma.$queryRaw<Array<{
      id: string; name: string; code: string; status: string; createdAt: Date; updatedAt: Date;
    }>>`
      SELECT "id", "name", "code", "status", "createdAt", "updatedAt"
      FROM "Subject"
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false AND "status" = 'ACTIVE'
      ORDER BY "name" ASC
    `;
  }

  async seedSubjects(context: RequestContext): Promise<{ seeded: number }> {
    // Step 1: Zombie cleanup â€” hard-delete any soft-deleted subjects for this tenant
    await this.prisma.subject.deleteMany({
      where: { tenantId: context.tenantId, softDelete: true },
    });

    // Step 2: Idempotency guard â€” abort if active subjects already exist
    const existing = await this.prisma.subject.count({
      where: { tenantId: context.tenantId, softDelete: false },
    });
    if (existing > 0) {
      throw new ConflictException('Subjects already exist for this school.');
    }

    // Step 3: Build seed data
    // Regional languages â€” INACTIVE by default (admin selects which ones apply)
    const languages = [
      'Assamese', 'Bengali', 'English', 'Gujarati', 'Hindi', 'Kannada',
      'Kashmiri', 'Konkani', 'Malayalam', 'Manipuri', 'Marathi', 'Nepali',
      'Odia', 'Punjabi', 'Sanskrit', 'Tamil', 'Telugu', 'Urdu',
    ];

    // Core academic subjects â€” ACTIVE by default
    const coreAcademic = [
      'Mathematics', 'Science', 'Biology', 'Physics', 'Chemistry',
      'Social Studies', 'Computer Science',
    ];

    // Derive a safe short code from the subject name
    const makeCode = (name: string) =>
      name.replace(/\s+/g, '').toUpperCase().slice(0, 12);

    const seeds = [
      ...languages.map((name) => ({
        id: randomUUID(),
        tenantId: context.tenantId,
        name,
        code: makeCode(name),
        status: 'INACTIVE' as const,
        createdBy: context.userId,
        updatedBy: context.userId,
      })),
      ...coreAcademic.map((name) => ({
        id: randomUUID(),
        tenantId: context.tenantId,
        name,
        code: makeCode(name),
        status: 'ACTIVE' as const,
        createdBy: context.userId,
        updatedBy: context.userId,
      })),
    ];

    // Step 4: Atomic insertion
    const result = await this.prisma.$transaction(async (tx) => {
      return tx.subject.createMany({ data: seeds as any[], skipDuplicates: true });
    });

    await this.publishAudit(
      context,
      'SEED',
      'Subject',
      context.tenantId,
      `Seeded ${result.count} subjects (${languages.length} languages + ${coreAcademic.length} core academic)`,
      { count: result.count, languages: languages.length, coreAcademic: coreAcademic.length },
    );

    return { seeded: result.count };
  }

  async updateSubjectStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
    context: RequestContext,
  ): Promise<{ updated: boolean }> {
    const result = await this.prisma.subject.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        status: status as any,
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-ACAD-SUBJ-4043] Subject not found');

    await this.publishAudit(
      context,
      'STATUS_TOGGLE',
      'Subject',
      id,
      `Subject status changed to ${status}`,
      { status },
    );
    return { updated: true };
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
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!subject) throw new NotFoundException('[ERR-ACAD-SUBJ-4042] Subject not found');

    await this.prisma.subject.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'Subject', id, 'Subject soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ Student CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listStudents(tenantId: string) {
    return this.prisma.student.findMany({
      where: { tenantId, softDelete: false },
      select: {
        id: true, admissionNumber: true, firstName: true, lastName: true,
        gender: true, dateOfBirth: true, status: true, createdAt: true, updatedAt: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getStudent(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!student) throw new NotFoundException('[ERR-STU-4041] Student not found');
    return student;
  }

  async updateStudent(id: string, dto: UpdateStudentDto, context: RequestContext): Promise<{ updated: boolean }> {
    // Validate parents up-front (outside the transaction) so we fail fast with a clear error.
    if (dto.parentIds !== undefined && dto.parentIds.length > 0) {
      const validParents = await this.prisma.parent.findMany({
        where: { id: { in: dto.parentIds }, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (validParents.length !== dto.parentIds.length) {
        throw new BadRequestException(
          '[ERR-PSM-4001] One or more parentIds do not exist or do not belong to this tenant',
        );
      }
    }

    // Atomic transaction: student update + parent mapping replacement succeed or fail together.
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.student.updateMany({
        where: { id, tenantId: context.tenantId, softDelete: false },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth }),
          ...(dto.gender !== undefined && { gender: dto.gender as any }),
          ...(dto.status !== undefined && { status: dto.status as any }),
          ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact }),
          ...(dto.addressLine !== undefined && { addressLine: dto.addressLine }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.pincode !== undefined && { pincode: dto.pincode }),
          updatedBy: context.userId,
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) throw new NotFoundException('[ERR-STU-4042] Student not found');

      // When parentIds is explicitly provided (even as []), atomically replace all mappings.
      if (dto.parentIds !== undefined) {
        await tx.parentStudentMapping.deleteMany({
          where: { studentId: id, tenantId: context.tenantId },
        });
        if (dto.parentIds.length > 0) {
          await tx.parentStudentMapping.createMany({
            data: dto.parentIds.map((parentId) => ({
              tenantId: context.tenantId,
              parentId,
              studentId: id,
              createdBy: context.userId,
              updatedBy: context.userId,
            })),
          });
        }
      }
    });

    await this.publishAudit(context, 'UPDATE', 'Student', id, 'Student updated', { ...dto });
    return { updated: true };
  }

  async deleteStudent(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('[ERR-STU-4043] Student not found');

    await this.prisma.student.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'Student', id, 'Student soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ Teacher GET single â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getTeacher(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!teacher) throw new NotFoundException('[ERR-FAC-4043] Teacher not found');
    return teacher;
  }

  // â”€â”€ Teacher-Subject M2M â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getTeacherSubjects(teacherId: string, tenantId: string) {
    // Verify teacher belongs to this tenant before exposing data.
    await this.getTeacher(teacherId, tenantId);

    return this.prisma.teacherSubject.findMany({
      where: { teacherId, tenantId },
      include: {
        subject: {
          select: { id: true, name: true, code: true, type: true, hasPractical: true },
        },
      },
    });
  }

  async assignTeacherSubjects(
    teacherId: string,
    dto: AssignTeacherSubjectsDto,
    context: RequestContext,
  ): Promise<{ assigned: number }> {
    // Verify teacher belongs to this tenant.
    await this.getTeacher(teacherId, context.tenantId);

    // Verify all subjects belong to the same tenant (tenant isolation guard).
    const validSubjects = await this.prisma.subject.findMany({
      where: { id: { in: dto.subjectIds }, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });

    if (validSubjects.length !== dto.subjectIds.length) {
      throw new BadRequestException(
        '[ERR-TS-4001] One or more subjectIds do not exist or do not belong to this tenant',
      );
    }

    // Upsert each link â€” idempotent, will not duplicate existing assignments.
    let assigned = 0;
    for (const subjectId of dto.subjectIds) {
      const exists = await this.prisma.teacherSubject.findUnique({
        where: { tenantId_teacherId_subjectId: { tenantId: context.tenantId, teacherId, subjectId } },
      });
      if (!exists) {
        await this.prisma.teacherSubject.create({
          data: { tenantId: context.tenantId, teacherId, subjectId, createdBy: context.userId },
        });
        assigned++;
      }
    }

    await this.publishAudit(context, 'ASSIGN_SUBJECTS', 'TeacherSubject', teacherId, 'Subjects assigned to teacher', {
      teacherId,
      subjectIds: dto.subjectIds,
      newAssignments: assigned,
    });
    return { assigned };
  }

  async removeTeacherSubject(
    teacherId: string,
    subjectId: string,
    context: RequestContext,
  ): Promise<{ removed: boolean }> {
    const link = await this.prisma.teacherSubject.findUnique({
      where: { tenantId_teacherId_subjectId: { tenantId: context.tenantId, teacherId, subjectId } },
    });
    if (!link) throw new NotFoundException('[ERR-TS-4041] Teacher-Subject link not found');

    await this.prisma.teacherSubject.delete({
      where: { tenantId_teacherId_subjectId: { tenantId: context.tenantId, teacherId, subjectId } },
    });

    await this.publishAudit(context, 'REMOVE_SUBJECT', 'TeacherSubject', teacherId, 'Subject removed from teacher', { teacherId, subjectId });
    return { removed: true };
  }

  // â”€â”€ StudentEnrollment READ / DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listEnrollments(tenantId: string, studentId?: string, academicYearId?: string) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        softDelete: false,
        ...(studentId && { studentId }),
        ...(academicYearId && { academicYearId }),
      },
      select: {
        id: true, studentId: true, classId: true, sectionId: true,
        academicYearId: true, rollNumber: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteEnrollment(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!enrollment) throw new NotFoundException('[ERR-ENROLL-4041] Enrollment not found');

    await this.prisma.studentEnrollment.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'StudentEnrollment', id, 'Enrollment soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ Parent CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listParents(tenantId: string) {
    return this.prisma.parent.findMany({
      where: { tenantId, softDelete: false },
      select: {
        id: true, firstName: true, lastName: true, relation: true,
        phone: true, email: true, createdAt: true, updatedAt: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getParent(id: string, tenantId: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!parent) throw new NotFoundException('[ERR-PAR-4041] Parent not found');
    return parent;
  }

  async createParent(dto: CreateParentDto, context: RequestContext): Promise<{ id: string }> {
    const id = randomUUID();
    await this.prisma.parent.create({
      data: {
        id,
        tenantId: context.tenantId,
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        relation: dto.relation as any,
        gender: dto.gender as any,
        phone: dto.phone,
        alternatePhone: dto.alternatePhone,
        email: dto.email,
        motherTongue: dto.motherTongue,
        profession: dto.profession,
        addressLine: dto.addressLine,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
    });

    await this.publishAudit(context, 'CREATE', 'Parent', id, 'Parent created', { userId: dto.userId });
    return { id };
  }

  async updateParent(id: string, dto: UpdateParentDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.parent.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.relation !== undefined && { relation: dto.relation as any }),
        ...(dto.gender !== undefined && { gender: dto.gender as any }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.alternatePhone !== undefined && { alternatePhone: dto.alternatePhone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.motherTongue !== undefined && { motherTongue: dto.motherTongue }),
        ...(dto.profession !== undefined && { profession: dto.profession }),
        ...(dto.addressLine !== undefined && { addressLine: dto.addressLine }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-PAR-4042] Parent not found');

    await this.publishAudit(context, 'UPDATE', 'Parent', id, 'Parent updated', { ...dto });
    return { updated: true };
  }

  async deleteParent(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const parent = await this.prisma.parent.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('[ERR-PAR-4043] Parent not found');

    await this.prisma.parent.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'Parent', id, 'Parent soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ ParentStudentMapping CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listParentStudentMappings(tenantId: string, parentId?: string, studentId?: string) {
    return this.prisma.parentStudentMapping.findMany({
      where: {
        tenantId,
        softDelete: false,
        ...(parentId && { parentId }),
        ...(studentId && { studentId }),
      },
      select: {
        id: true, parentId: true, studentId: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createParentStudentMapping(
    dto: CreateParentStudentMappingDto,
    context: RequestContext,
  ): Promise<{ id: string }> {
    await this.assertEntityExists('Parent', dto.parentId, context.tenantId);
    await this.assertEntityExists('Student', dto.studentId, context.tenantId);

    const id = randomUUID();
    await this.prisma.parentStudentMapping.create({
      data: {
        id,
        tenantId: context.tenantId,
        parentId: dto.parentId,
        studentId: dto.studentId,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
    });

    await this.publishAudit(context, 'CREATE', 'ParentStudentMapping', id, 'Parent-student mapped', {
      parentId: dto.parentId,
      studentId: dto.studentId,
    });
    return { id };
  }

  async deleteParentStudentMapping(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const mapping = await this.prisma.parentStudentMapping.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!mapping) throw new NotFoundException('[ERR-PSM-4041] Parent-student mapping not found');

    await this.prisma.parentStudentMapping.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'ParentStudentMapping', id, 'Parent-student mapping deleted', {});
    return { deleted: true };
  }

  // â”€â”€ StudentEnrollment UPDATE / GET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getEnrollment(id: string, tenantId: string) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!enrollment) throw new NotFoundException('[ERR-ENROLL-4042] Enrollment not found');
    return enrollment;
  }

  async updateEnrollment(
    id: string,
    dto: UpdateStudentEnrollmentDto,
    context: RequestContext,
  ): Promise<{ updated: boolean }> {
    const result = await this.prisma.studentEnrollment.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.rollNumber !== undefined && { rollNumber: dto.rollNumber }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-ENROLL-4041] Enrollment not found');

    await this.publishAudit(context, 'UPDATE', 'StudentEnrollment', id, 'Enrollment updated', { ...dto });
    return { updated: true };
  }

  // â”€â”€ ClassTeacherAssignment full CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listClassTeacherAssignments(tenantId: string) {
    return this.prisma.classTeacherAssignment.findMany({
      where: { tenantId, softDelete: false },
      select: {
        id: true,
        classId: true,
        sectionId: true,
        teacherId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClassTeacherAssignment(id: string, tenantId: string) {
    const assignment = await this.prisma.classTeacherAssignment.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!assignment) throw new NotFoundException('[ERR-CTA-4041] Class-teacher assignment not found');
    return assignment;
  }

  async updateClassTeacherAssignment(
    id: string,
    dto: UpdateClassTeacherAssignmentDto,
    context: RequestContext,
  ): Promise<{ updated: boolean }> {
    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.teacherId, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (!teacher) throw new NotFoundException('[ERR-CTA-4001] Teacher not found in this tenant');
    }

    const result = await this.prisma.classTeacherAssignment.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.teacherId !== undefined && { teacherId: dto.teacherId }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-CTA-4041] Class-teacher assignment not found');

    await this.publishAudit(context, 'UPDATE', 'ClassTeacherAssignment', id, 'Class-teacher assignment updated', { ...dto });
    return { updated: true };
  }

  async deleteClassTeacherAssignment(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const assignment = await this.prisma.classTeacherAssignment.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!assignment) throw new NotFoundException('[ERR-CTA-4042] Class-teacher assignment not found');

    await this.prisma.classTeacherAssignment.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'ClassTeacherAssignment', id, 'Class-teacher assignment deleted', {});
    return { deleted: true };
  }

  // â”€â”€ Period full CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Calculate duration in minutes from two HH:MM strings.
   * e.g. calcDuration("09:00", "09:50") â†’ 50
   */
  private calcDurationMins(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  /** Format duration minutes as "50 min" or "1 hr 30 min". */
  private formatDuration(mins: number): string {
    if (mins <= 0) return '0 min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h} hr ${m} min`;
  }

  async createPeriod(dto: CreatePeriodDto, context: RequestContext): Promise<{ id: string }> {
    const { id } = await this.prisma.period.create({
      data: {
        tenantId:       context.tenantId,
        name:           dto.name,
        startTime:      dto.startTime,
        endTime:        dto.endTime,
        orderIndex:     dto.orderIndex ?? 0,
        academicYearId: dto.academicYearId || undefined,
        createdBy:      context.userId,
        updatedBy:      context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'CREATE', 'Period', id, 'Period created', { name: dto.name });
    return { id };
  }

  async listPeriods(tenantId: string, academicYearId?: string) {
    const rows = await this.prisma.period.findMany({
      where: {
        tenantId,
        softDelete: false,
        ...(academicYearId && { academicYearId }),
      },
      select: {
        id:             true,
        name:           true,
        startTime:      true,
        endTime:        true,
        orderIndex:     true,
        academicYearId: true,
        createdAt:      true,
        updatedAt:      true,
      },
      orderBy: { orderIndex: 'asc' },
    });

    return rows.map((r) => ({
      ...r,
      duration: this.formatDuration(this.calcDurationMins(r.startTime, r.endTime)),
    }));
  }

  async getPeriod(id: string, tenantId: string) {
    const period = await this.prisma.period.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!period) throw new NotFoundException('[ERR-PER-4041] Period not found');
    const durationMins = this.calcDurationMins(period.startTime, period.endTime);
    return { ...period, duration: this.formatDuration(durationMins) };
  }

  async updatePeriod(
    id: string,
    dto: UpdatePeriodDto,
    context: RequestContext,
  ): Promise<{ updated: boolean; cascaded: number }> {
    // Fetch the current period so we can compute the delta and check ownership
    const current = await this.prisma.period.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
    });
    if (!current) throw new NotFoundException('[ERR-PER-4041] Period not found');

    const updateData = {
      ...(dto.name           !== undefined && { name:           dto.name }),
      ...(dto.startTime      !== undefined && { startTime:      dto.startTime }),
      ...(dto.endTime        !== undefined && { endTime:        dto.endTime }),
      ...(dto.orderIndex     !== undefined && { orderIndex:     dto.orderIndex }),
      ...(dto.academicYearId !== undefined && { academicYearId: dto.academicYearId || null }),
      updatedBy: context.userId,
      updatedAt: new Date(),
    };

    // â”€â”€ Ripple-cascade path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (dto.cascadeUpdates && dto.endTime !== undefined && dto.endTime !== current.endTime) {
      const deltaMins = timeToMins(dto.endTime) - timeToMins(current.endTime);

      const subsequent = await this.prisma.period.findMany({
        where: {
          tenantId:      current.tenantId,
          academicYearId: current.academicYearId ?? null,
          orderIndex:    { gt: current.orderIndex },
          softDelete:    false,
        },
        orderBy: { orderIndex: 'asc' },
      });

      await this.prisma.$transaction([
        this.prisma.period.update({ where: { id }, data: updateData }),
        ...subsequent.map((p) =>
          this.prisma.period.update({
            where: { id: p.id },
            data: {
              startTime: addMins(p.startTime, deltaMins),
              endTime:   addMins(p.endTime,   deltaMins),
              updatedBy: context.userId,
              updatedAt: new Date(),
            },
          }),
        ),
      ]);

      await this.publishAudit(context, 'UPDATE', 'Period', id, 'Period updated with cascade', {
        ...dto,
        cascadedCount: subsequent.length,
      });
      return { updated: true, cascaded: subsequent.length };
    }

    // â”€â”€ Simple (no-cascade) path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await this.prisma.period.update({ where: { id }, data: updateData });

    await this.publishAudit(context, 'UPDATE', 'Period', id, 'Period updated', { ...dto });
    return { updated: true, cascaded: 0 };
  }

  async deletePeriod(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const period = await this.prisma.period.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!period) throw new NotFoundException('[ERR-PER-4042] Period not found');

    await this.prisma.period.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'Period', id, 'Period soft-deleted', {});
    return { deleted: true };
  }

  /**
   * Seed exactly 10 standard school periods for the active academic year.
   * Idempotency-guarded: throws 409 if any live periods already exist.
   */
  async seedPeriods(context: RequestContext): Promise<{ seeded: number }> {
    // 1. Purge zombie (soft-deleted) rows so their unique-name slots are free
    await this.prisma.period.deleteMany({
      where: { tenantId: context.tenantId, softDelete: true },
    });

    // 2. Idempotency guard
    const existing = await this.prisma.period.count({
      where: { tenantId: context.tenantId, softDelete: false },
    });
    if (existing > 0) {
      throw new ConflictException('Periods already exist for this school. Delete them first to re-seed.');
    }

    // 3. Resolve the active academic year (optional link)
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: context.tenantId, isActive: true, softDelete: false },
      select: { id: true },
    });

    // 4. The canonical 10-slot daily schedule (stored in 24-hr HH:MM)
    const schedule = [
      { name: 'Period 1', startTime: '09:15', endTime: '10:00', orderIndex: 1  },
      { name: 'Period 2', startTime: '10:00', endTime: '10:45', orderIndex: 2  },
      { name: 'Period 3', startTime: '10:45', endTime: '11:30', orderIndex: 3  },
      { name: 'Interval', startTime: '11:30', endTime: '11:45', orderIndex: 4  },
      { name: 'Period 4', startTime: '11:45', endTime: '12:00', orderIndex: 5  },
      { name: 'Period 5', startTime: '12:00', endTime: '12:45', orderIndex: 6  },
      { name: 'Lunch',    startTime: '12:45', endTime: '13:30', orderIndex: 7  },
      { name: 'Period 6', startTime: '13:30', endTime: '14:15', orderIndex: 8  },
      { name: 'Period 7', startTime: '14:15', endTime: '15:00', orderIndex: 9  },
      { name: 'Period 8', startTime: '15:00', endTime: '15:30', orderIndex: 10 },
    ];

    const data = schedule.map((s) => ({
      id:             randomUUID(),
      tenantId:       context.tenantId,
      name:           s.name,
      startTime:      s.startTime,
      endTime:        s.endTime,
      orderIndex:     s.orderIndex,
      academicYearId: activeYear?.id ?? null,
      createdBy:      context.userId,
      updatedBy:      context.userId,
    }));

    // Use individual create() calls inside a transaction instead of createMany().
    // createMany() uses PostgreSQL's binary COPY protocol which can crash with
    // "E08P01: insufficient data left in message" when the schema was updated
    // via manual SQL. Individual creates use standard INSERT statements and also
    // produce readable errors if a column is genuinely missing.
    const created = await this.prisma.$transaction(
      data.map((row) => this.prisma.period.create({ data: row })),
    );

    await this.publishAudit(
      context, 'SEED', 'Period', context.tenantId,
      'Standard school periods seeded', { count: created.length },
    );

    return { seeded: created.length };
  }

  // â”€â”€ Master Template seeder (PLATFORM_ADMIN only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Seeds the canonical 10-slot schedule into the reserved MASTER_TEMPLATE
   * partition.  Always forces tenantId = 'MASTER_TEMPLATE' regardless of the
   * caller's JWT tenant.
   */
  async seedMasterPeriods(context: RequestContext): Promise<{ seeded: number }> {
    const MASTER      = 'MASTER_TEMPLATE';
    const MASTER_YEAR = 'MASTER_YEAR';

    // â”€â”€ Step 1: Guarantee master tenant partition exists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await this.prisma.tenant.upsert({
      where:  { id: MASTER },
      update: {},
      create: {
        id:     MASTER,
        code:   'MASTER-TPL',
        name:   'System Master Template',
        status: TenantStatus.ACTIVE,
        domain: 'master.internal',
      },
    });

    // â”€â”€ Step 2: Guarantee master academic year exists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const now       = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);   // Jan 1
    const yearEnd   = new Date(now.getFullYear(), 11, 31); // Dec 31
    await this.prisma.academicYear.upsert({
      where:  { id: MASTER_YEAR },
      update: {},
      create: {
        id:        MASTER_YEAR,
        tenantId:  MASTER,
        name:      'Master Year',
        startDate: yearStart,
        endDate:   yearEnd,
        isActive:  true,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
    });

    // â”€â”€ Step 3: Purge soft-deleted rows and check idempotency â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await this.prisma.period.deleteMany({ where: { tenantId: MASTER, softDelete: true } });

    const existing = await this.prisma.period.count({
      where: { tenantId: MASTER, softDelete: false },
    });
    if (existing > 0) {
      throw new ConflictException('Master template already contains periods. Delete them first to re-seed.');
    }

    // â”€â”€ Step 4: Seed canonical schedule (both parent FKs now guaranteed) â”€â”€â”€â”€â”€
    const schedule = [
      { name: 'Period 1', startTime: '09:15', endTime: '10:00', orderIndex: 1  },
      { name: 'Period 2', startTime: '10:00', endTime: '10:45', orderIndex: 2  },
      { name: 'Period 3', startTime: '10:45', endTime: '11:30', orderIndex: 3  },
      { name: 'Interval', startTime: '11:30', endTime: '11:45', orderIndex: 4  },
      { name: 'Period 4', startTime: '11:45', endTime: '12:00', orderIndex: 5  },
      { name: 'Period 5', startTime: '12:00', endTime: '12:45', orderIndex: 6  },
      { name: 'Lunch',    startTime: '12:45', endTime: '13:30', orderIndex: 7  },
      { name: 'Period 6', startTime: '13:30', endTime: '14:15', orderIndex: 8  },
      { name: 'Period 7', startTime: '14:15', endTime: '15:00', orderIndex: 9  },
      { name: 'Period 8', startTime: '15:00', endTime: '15:30', orderIndex: 10 },
    ];

    const data = schedule.map((s) => ({
      id:             randomUUID(),
      tenantId:       MASTER,
      name:           s.name,
      startTime:      s.startTime,
      endTime:        s.endTime,
      orderIndex:     s.orderIndex,
      academicYearId: MASTER_YEAR,
      createdBy:      context.userId,
      updatedBy:      context.userId,
    }));

    const created = await this.prisma.$transaction(
      data.map((row) => this.prisma.period.create({ data: row })),
    );

    await this.publishAudit(
      context, 'SEED', 'Period', MASTER,
      'Master template periods seeded', { count: created.length },
    );
    return { seeded: created.length };
  }

  // â”€â”€ School seeder from master (SCHOOL_ADMIN) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Copies all periods from MASTER_TEMPLATE into the calling school's tenant.
   * Throws if the master template is empty or the school already has periods.
   */
  async seedPeriodsFromMaster(context: RequestContext): Promise<{ seeded: number }> {
    const MASTER = 'MASTER_TEMPLATE';

    // 1. Fetch master template rows
    const masterRows = await this.prisma.period.findMany({
      where: { tenantId: MASTER, softDelete: false },
      orderBy: { orderIndex: 'asc' },
    });
    if (masterRows.length === 0) {
      throw new BadRequestException('Master templates not configured. Contact System Admin.');
    }

    // 2. Idempotency guard for the school
    await this.prisma.period.deleteMany({
      where: { tenantId: context.tenantId, softDelete: true },
    });
    const existing = await this.prisma.period.count({
      where: { tenantId: context.tenantId, softDelete: false },
    });
    if (existing > 0) {
      throw new ConflictException('Periods already exist for this school. Delete them first to re-seed.');
    }

    // 3. Resolve active academic year (optional link)
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: context.tenantId, isActive: true, softDelete: false },
      select: { id: true },
    });

    // 4. Clone master rows into school partition
    const data = masterRows.map((m) => ({
      id:             randomUUID(),
      tenantId:       context.tenantId,
      name:           m.name,
      startTime:      m.startTime,
      endTime:        m.endTime,
      orderIndex:     m.orderIndex,
      academicYearId: activeYear?.id ?? null,
      createdBy:      context.userId,
      updatedBy:      context.userId,
    }));

    const created = await this.prisma.$transaction(
      data.map((row) => this.prisma.period.create({ data: row })),
    );

    await this.publishAudit(
      context, 'SEED', 'Period', context.tenantId,
      'Periods seeded from master template', { count: created.length },
    );
    return { seeded: created.length };
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

  // â”€â”€ Attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async saveBulkAttendance(
    dto: BulkAttendanceDto,
    context: RequestContext,
  ): Promise<{ sessionId: string }> {
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    await this.assertEntityExists('Section', dto.sectionId, context.tenantId);
    await this.assertEntityExists('AcademicYear', dto.academicYearId, context.tenantId);

    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    const sessionId = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceSession.findFirst({
        where: { tenantId: context.tenantId, date, classId: dto.classId, sectionId: dto.sectionId, softDelete: false },
        select: { id: true },
      });

      let sId: string;
      if (existing) {
        sId = existing.id;
        // Atomically replace existing records.
        await tx.attendanceRecord.deleteMany({ where: { sessionId: sId, tenantId: context.tenantId } });
        await tx.attendanceSession.update({
          where: { id: sId },
          data: { updatedBy: context.userId, updatedAt: new Date() },
        });
      } else {
        const session = await tx.attendanceSession.create({
          data: {
            tenantId: context.tenantId,
            date,
            classId: dto.classId,
            sectionId: dto.sectionId,
            academicYearId: dto.academicYearId,
            createdBy: context.userId,
            updatedBy: context.userId,
          },
          select: { id: true },
        });
        sId = session.id;
      }

      await tx.attendanceRecord.createMany({
        data: dto.records.map((r) => ({
          tenantId: context.tenantId,
          sessionId: sId,
          studentId: r.studentId,
          status: r.status as any,
          remarks: r.remarks,
          createdBy: context.userId,
          updatedBy: context.userId,
        })),
        skipDuplicates: true,
      });

      return sId;
    });

    await this.publishAudit(context, 'BULK_SAVE', 'AttendanceSession', sessionId, 'Bulk attendance saved', {
      date: dto.date,
      classId: dto.classId,
      sectionId: dto.sectionId,
      studentCount: dto.records.length,
    });

    return { sessionId };
  }

  async listAttendanceSessions(
    tenantId: string,
    date?: string,
    classId?: string,
    sectionId?: string,
  ) {
    return this.prisma.attendanceSession.findMany({
      where: {
        tenantId,
        softDelete: false,
        ...(date && { date: new Date(date) }),
        ...(classId && { classId }),
        ...(sectionId && { sectionId }),
      },
      select: {
        id: true, date: true, classId: true, sectionId: true,
        academicYearId: true, status: true, createdAt: true, updatedAt: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async getAttendanceSession(id: string, tenantId: string) {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id, tenantId, softDelete: false },
      include: {
        records: {
          where: { softDelete: false },
          select: { id: true, studentId: true, status: true, remarks: true },
        },
      },
    });
    if (!session) throw new NotFoundException('[ERR-ATT-4041] Attendance session not found');
    return session;
  }

  // â”€â”€ GradeScale CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createGradeScale(dto: CreateGradeScaleDto, context: RequestContext): Promise<{ id: string }> {
    if (dto.minPercentage >= dto.maxPercentage) {
      throw new BadRequestException('[ERR-GS-4001] minPercentage must be less than maxPercentage');
    }
    const { id } = await this.prisma.gradeScale.create({
      data: {
        tenantId: context.tenantId,
        name: dto.name,
        grade: dto.grade,
        minPercentage: dto.minPercentage,
        maxPercentage: dto.maxPercentage,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });
    await this.publishAudit(context, 'CREATE', 'GradeScale', id, 'Grade scale created', { name: dto.name });
    return { id };
  }

  async listGradeScales(tenantId: string) {
    return this.prisma.gradeScale.findMany({
      where: { tenantId, softDelete: false },
      select: {
        id: true, name: true, grade: true,
        minPercentage: true, maxPercentage: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { minPercentage: 'desc' },
    });
  }

  async getGradeScale(id: string, tenantId: string) {
    const row = await this.prisma.gradeScale.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!row) throw new NotFoundException('[ERR-GS-4041] Grade scale not found');
    return row;
  }

  async updateGradeScale(id: string, dto: UpdateGradeScaleDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.gradeScale.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.name          !== undefined && { name:          dto.name }),
        ...(dto.grade         !== undefined && { grade:         dto.grade }),
        ...(dto.minPercentage !== undefined && { minPercentage: dto.minPercentage }),
        ...(dto.maxPercentage !== undefined && { maxPercentage: dto.maxPercentage }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-GS-4041] Grade scale not found');
    await this.publishAudit(context, 'UPDATE', 'GradeScale', id, 'Grade scale updated', { ...dto });
    return { updated: true };
  }

  async deleteGradeScale(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const row = await this.prisma.gradeScale.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('[ERR-GS-4042] Grade scale not found');
    await this.prisma.gradeScale.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });
    await this.publishAudit(context, 'DELETE', 'GradeScale', id, 'Grade scale soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ Exam CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createExam(dto: CreateExamDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('AcademicYear', dto.academicYearId, context.tenantId);
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    const { id } = await this.prisma.exam.create({
      data: {
        tenantId: context.tenantId,
        name: dto.name,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        ...(dto.totalMarks !== undefined && { totalMarks: dto.totalMarks }),
        ...(dto.status     !== undefined && { status: dto.status as any }),
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });
    await this.publishAudit(context, 'CREATE', 'Exam', id, 'Exam created', { name: dto.name });
    return { id };
  }

  async listExams(tenantId: string, academicYearId?: string, classId?: string) {
    return this.prisma.exam.findMany({
      where: {
        tenantId,
        softDelete: false,
        ...(academicYearId && { academicYearId }),
        ...(classId        && { classId }),
      },
      select: {
        id: true, name: true, academicYearId: true, classId: true,
        status: true, startDate: true, endDate: true, totalMarks: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async getExam(id: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!exam) throw new NotFoundException('[ERR-EXAM-4041] Exam not found');
    return exam;
  }

  async updateExam(id: string, dto: UpdateExamDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.exam.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.name      !== undefined && { name:      dto.name }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate }),
        ...(dto.endDate   !== undefined && { endDate:   dto.endDate }),
        ...(dto.status    !== undefined && { status:    dto.status as any }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-EXAM-4041] Exam not found');
    await this.publishAudit(context, 'UPDATE', 'Exam', id, 'Exam updated', { ...dto });
    return { updated: true };
  }

  async deleteExam(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!exam) throw new NotFoundException('[ERR-EXAM-4042] Exam not found');
    await this.prisma.exam.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });
    await this.publishAudit(context, 'DELETE', 'Exam', id, 'Exam soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ ExamSubject CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createExamSubject(dto: CreateExamSubjectDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('Exam',    dto.examId,    context.tenantId);
    await this.assertEntityExists('Subject', dto.subjectId, context.tenantId);
    const { id } = await this.prisma.examSubject.create({
      data: {
        tenantId:  context.tenantId,
        examId:    dto.examId,
        subjectId: dto.subjectId,
        maxMarks:  dto.maxMarks,
        ...(dto.weightage !== undefined && { weightage: dto.weightage }),
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });
    await this.publishAudit(context, 'CREATE', 'ExamSubject', id, 'Exam subject created', {
      examId: dto.examId, subjectId: dto.subjectId,
    });
    return { id };
  }

  async listExamSubjects(tenantId: string, examId?: string) {
    return this.prisma.examSubject.findMany({
      where: {
        tenantId,
        softDelete: false,
        ...(examId && { examId }),
      },
      select: {
        id: true, examId: true, subjectId: true,
        maxMarks: true, weightage: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getExamSubject(id: string, tenantId: string) {
    const row = await this.prisma.examSubject.findFirst({
      where: { id, tenantId, softDelete: false },
    });
    if (!row) throw new NotFoundException('[ERR-EXSUB-4041] Exam subject not found');
    return row;
  }

  async updateExamSubject(id: string, dto: UpdateExamSubjectDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.examSubject.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.maxMarks  !== undefined && { maxMarks:  dto.maxMarks }),
        ...(dto.weightage !== undefined && { weightage: dto.weightage }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-EXSUB-4041] Exam subject not found');
    await this.publishAudit(context, 'UPDATE', 'ExamSubject', id, 'Exam subject updated', { ...dto });
    return { updated: true };
  }

  async deleteExamSubject(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const row = await this.prisma.examSubject.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('[ERR-EXSUB-4042] Exam subject not found');
    await this.prisma.examSubject.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });
    await this.publishAudit(context, 'DELETE', 'ExamSubject', id, 'Exam subject soft-deleted', {});
    return { deleted: true };
  }

  // â”€â”€ Student Marks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async saveBulkMarks(dto: BulkMarksDto, context: RequestContext): Promise<{ count: number }> {
    // 1. Resolve ExamSubject â†’ examId, subjectId, maxMarks
    const examSubject = await this.prisma.examSubject.findFirst({
      where: { id: dto.examSubjectId, tenantId: context.tenantId, softDelete: false },
      select: { examId: true, subjectId: true, maxMarks: true },
    });
    if (!examSubject) throw new NotFoundException('[ERR-MARK-4041] Exam subject not found');

    // 2. Validate: obtainedMarks must not exceed maxMarks for non-absent students
    for (const rec of dto.records) {
      if (!rec.isAbsent && rec.obtainedMarks > examSubject.maxMarks) {
        throw new BadRequestException(
          `[ERR-MARK-4000] Student ${rec.studentId}: obtainedMarks (${rec.obtainedMarks}) exceeds maxMarks (${examSubject.maxMarks})`,
        );
      }
    }

    const studentIds = dto.records.map((r) => r.studentId);

    // 3. Atomic delete + create inside a single transaction
    const count = await this.prisma.$transaction(async (tx) => {
      await tx.studentMark.deleteMany({
        where: {
          tenantId: context.tenantId,
          examId: examSubject.examId,
          subjectId: examSubject.subjectId,
          studentId: { in: studentIds },
        },
      });

      const result = await tx.studentMark.createMany({
        data: dto.records.map((r) => ({
          tenantId: context.tenantId,
          examId: examSubject.examId,
          subjectId: examSubject.subjectId,
          studentId: r.studentId,
          marksObtained: r.isAbsent ? 0 : r.obtainedMarks,
          remarks: r.isAbsent
            ? `ABSENT${r.remarks ? `: ${r.remarks}` : ''}`
            : (r.remarks ?? null),
          createdBy: context.userId,
          updatedBy: context.userId,
        })),
      });

      return result.count;
    });

    await this.publishAudit(context, 'BULK_SAVE', 'StudentMark', dto.examSubjectId, 'Bulk marks saved', {
      examSubjectId: dto.examSubjectId,
      sectionId: dto.sectionId,
      studentCount: count,
    });

    return { count };
  }

  async listMarks(
    tenantId: string,
    examSubjectId: string,
    sectionId: string,
  ) {
    const examSubject = await this.prisma.examSubject.findFirst({
      where: { id: examSubjectId, tenantId, softDelete: false },
      select: { examId: true, subjectId: true, maxMarks: true },
    });
    if (!examSubject) throw new NotFoundException('[ERR-MARK-4042] Exam subject not found');

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, sectionId, softDelete: false },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    const marks = await this.prisma.studentMark.findMany({
      where: {
        tenantId,
        examId: examSubject.examId,
        subjectId: examSubject.subjectId,
        studentId: { in: studentIds },
        softDelete: false,
      },
      select: { id: true, studentId: true, marksObtained: true, remarks: true },
    });

    return {
      examId: examSubject.examId,
      subjectId: examSubject.subjectId,
      maxMarks: examSubject.maxMarks,
      marks,
    };
  }

  // â”€â”€ Result Aggregation Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async processExamResults(
    examId: string,
    classId: string,
    context: RequestContext,
  ): Promise<{ processed: number }> {
    // 1. Validate the exam is in this tenant and belongs to the given class
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, tenantId: context.tenantId, softDelete: false },
      select: { id: true, classId: true },
    });
    if (!exam) throw new NotFoundException('[ERR-PROC-4041] Exam not found');
    if (exam.classId !== classId) {
      throw new BadRequestException('[ERR-PROC-4000] Exam does not belong to this class');
    }

    // 2. Students enrolled in this class (any section)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId: context.tenantId, classId, softDelete: false },
      select: { studentId: true, sectionId: true },
    });
    if (enrollments.length === 0) {
      throw new BadRequestException('[ERR-PROC-4001] No students enrolled in this class');
    }
    const studentIds = enrollments.map((e) => e.studentId);
    const sectionOfStudent: Record<string, string> = {};
    for (const e of enrollments) sectionOfStudent[e.studentId] = e.sectionId;

    // 3. Total max marks across all ExamSubjects for this exam
    const examSubjects = await this.prisma.examSubject.findMany({
      where: { tenantId: context.tenantId, examId, softDelete: false },
      select: { maxMarks: true },
    });
    const totalMaxMarks = examSubjects.reduce((sum, es) => sum + es.maxMarks, 0);
    if (totalMaxMarks === 0) {
      throw new BadRequestException('[ERR-PROC-4002] No exam subjects defined or total max marks is zero');
    }

    // 4. All marks submitted for this exam & students
    const allMarks = await this.prisma.studentMark.findMany({
      where: {
        tenantId: context.tenantId,
        examId,
        studentId: { in: studentIds },
        softDelete: false,
      },
      select: { studentId: true, marksObtained: true },
    });

    // 5. Grade scale (highest minPercentage first â†’ first match wins)
    const gradeScales = await this.prisma.gradeScale.findMany({
      where: { tenantId: context.tenantId, softDelete: false },
      orderBy: { minPercentage: 'desc' },
    });

    function findGrade(pct: number): string {
      for (const gs of gradeScales) {
        if (pct >= gs.minPercentage && pct <= gs.maxPercentage) return gs.grade;
      }
      return 'N/A';
    }

    // 6. Aggregate marks per student
    const marksByStudent: Record<string, number> = {};
    for (const m of allMarks) {
      marksByStudent[m.studentId] = (marksByStudent[m.studentId] ?? 0) + m.marksObtained;
    }

    type StudentAgg = {
      studentId: string;
      sectionId: string;
      totalObtained: number;
      percentage: number;
      grade: string;
    };

    const studentAggs: StudentAgg[] = studentIds.map((studentId) => {
      const totalObtained = marksByStudent[studentId] ?? 0;
      const rawPct = (totalObtained / totalMaxMarks) * 100;
      const percentage = parseFloat(rawPct.toFixed(2));
      return {
        studentId,
        sectionId: sectionOfStudent[studentId],
        totalObtained,
        percentage,
        grade: findGrade(percentage),
      };
    });

    // 7. Class rank (all students sorted by totalObtained descending)
    const sortedByTotal = [...studentAggs].sort((a, b) => b.totalObtained - a.totalObtained);
    const classRankMap: Record<string, number> = {};
    sortedByTotal.forEach((s, i) => { classRankMap[s.studentId] = i + 1; });

    // 8. Section rank (within each section, sorted by totalObtained descending)
    const bySec: Record<string, StudentAgg[]> = {};
    for (const sa of studentAggs) {
      if (!bySec[sa.sectionId]) bySec[sa.sectionId] = [];
      bySec[sa.sectionId].push(sa);
    }
    const sectionRankMap: Record<string, number> = {};
    for (const secStudents of Object.values(bySec)) {
      const secSorted = [...secStudents].sort((a, b) => b.totalObtained - a.totalObtained);
      secSorted.forEach((s, i) => { sectionRankMap[s.studentId] = i + 1; });
    }

    // 9. Atomic transaction: wipe stale results + write fresh ones
    const processed = await this.prisma.$transaction(async (tx) => {
      await tx.studentExamResult.deleteMany({
        where: { tenantId: context.tenantId, examId, studentId: { in: studentIds } },
      });
      await tx.studentExamAggregate.deleteMany({
        where: { tenantId: context.tenantId, examId, studentId: { in: studentIds } },
      });

      await tx.studentExamResult.createMany({
        data: studentAggs.map((sa) => ({
          tenantId: context.tenantId,
          examId,
          studentId: sa.studentId,
          totalMarks: sa.totalObtained,
          percentage: sa.percentage,
          grade: sa.grade,
          createdBy: context.userId,
          updatedBy: context.userId,
        })),
      });

      await tx.studentExamAggregate.createMany({
        data: studentAggs.map((sa) => ({
          tenantId: context.tenantId,
          examId,
          studentId: sa.studentId,
          totalMarks: sa.totalObtained,
          percentage: sa.percentage,
          grade: sa.grade,
          classRank: classRankMap[sa.studentId],
          sectionRank: sectionRankMap[sa.studentId],
          createdBy: context.userId,
          updatedBy: context.userId,
        })),
      });

      return studentAggs.length;
    });

    await this.publishAudit(
      context,
      'PROCESS_RESULTS',
      'StudentExamResult',
      examId,
      'Exam results processed and aggregated',
      { examId, classId, studentCount: processed },
    );

    return { processed };
  }

  // â”€â”€ Onboarding Seeder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Idempotent PAN-India Quick Setup Seeder.
   * Creates 3 academic years, 10 classes (for the active year), 3 sections per
   * class (A-C), 5 core subjects, and all 17 official Indian language subjects
   * in a single atomic transaction.
   */
  async seedDefaultSetup(
    tenantId: string,
    userId: string,
  ): Promise<{ seeded: number }> {
    // â”€â”€ Idempotency guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existingCount = await this.prisma.class.count({
      where: { tenantId, softDelete: false },
    });
    if (existingCount > 0) {
      throw new ConflictException('School is already set up.');
    }

    // â”€â”€ Pre-generate deterministic IDs so the batch array can reference them
    const yearIds = [randomUUID(), randomUUID(), randomUUID()];
    const classIds = Array.from({ length: 10 }, () => randomUUID());

    const NOW = new Date();
    const base = (id: string) => ({
      id,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    // â”€â”€ Academic Years â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const academicYearOps = [
      this.prisma.academicYear.create({
        data: {
          ...base(yearIds[0]),
          name: '2025-2026',
          startDate: new Date('2025-04-01'),
          endDate:   new Date('2026-03-31'),
          isActive:  false, // COMPLETED
        },
      }),
      this.prisma.academicYear.create({
        data: {
          ...base(yearIds[1]),
          name: '2026-2027',
          startDate: new Date('2026-04-01'),
          endDate:   new Date('2027-03-31'),
          isActive:  true,  // ACTIVE
        },
      }),
      this.prisma.academicYear.create({
        data: {
          ...base(yearIds[2]),
          name: '2027-2028',
          startDate: new Date('2027-04-01'),
          endDate:   new Date('2028-03-31'),
          isActive:  false, // PLANNED
        },
      }),
    ];

    // â”€â”€ Classes (tied to the ACTIVE academic year 2026-2027) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const classNames = [
      'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
      'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
    ];
    const classCodes = [
      'G01', 'G02', 'G03', 'G04', 'G05',
      'G06', 'G07', 'G08', 'G09', 'G10',
    ];
    const classOps = classNames.map((name, i) =>
      this.prisma.class.create({
        data: {
          ...base(classIds[i]),
          name,
          code: classCodes[i],
          academicYearId: yearIds[1], // ACTIVE year
        },
      }),
    );

    // â”€â”€ Sections (A, B, C for every class) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const sectionLabels = ['A', 'B', 'C'];
    const sectionOps = classIds.flatMap((classId) =>
      sectionLabels.map((name) =>
        this.prisma.section.create({
          data: {
            ...base(randomUUID()),
            name,
            classId,
          },
        }),
      ),
    );

    // â”€â”€ Core Subjects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const coreSubjectData: Array<{ name: string; code: string }> = [
      { name: 'Mathematics',                  code: 'MATH' },
      { name: 'Science',                      code: 'SCI'  },
      { name: 'Social Studies',               code: 'SS'   },
      { name: 'Computer Science',             code: 'CS'   },
      { name: 'Environmental Science (EVS)',  code: 'EVS'  },
    ];
    const coreOps = coreSubjectData.map((s) =>
      this.prisma.subject.create({
        data: {
          ...base(randomUUID()),
          name: s.name,
          code: s.code,
          type: 'CORE' as any,
        },
      }),
    );

    // â”€â”€ Language Subjects (all 17 languages on the Indian currency note) â”€â”€â”€
    const langSubjectData: Array<{ name: string; code: string }> = [
      { name: 'English',   code: 'EN'  },
      { name: 'Hindi',     code: 'HI'  },
      { name: 'Assamese',  code: 'AS'  },
      { name: 'Bengali',   code: 'BN'  },
      { name: 'Gujarati',  code: 'GU'  },
      { name: 'Kannada',   code: 'KN'  },
      { name: 'Kashmiri',  code: 'KS'  },
      { name: 'Konkani',   code: 'KOK' },
      { name: 'Malayalam', code: 'ML'  },
      { name: 'Marathi',   code: 'MR'  },
      { name: 'Nepali',    code: 'NE'  },
      { name: 'Odia',      code: 'OD'  },
      { name: 'Punjabi',   code: 'PU'  },
      { name: 'Sanskrit',  code: 'SA'  },
      { name: 'Tamil',     code: 'TA'  },
      { name: 'Telugu',    code: 'TE'  },
      { name: 'Urdu',      code: 'UR'  },
    ];
    const langOps = langSubjectData.map((s) =>
      this.prisma.subject.create({
        data: {
          ...base(randomUUID()),
          name: s.name,
          code: s.code,
          type: 'LANGUAGE' as any,
        },
      }),
    );

    // â”€â”€ Execute all 65 writes atomically â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // 3 academic years + 10 classes + 30 sections + 5 core + 17 language = 65
    await this.prisma.$transaction([
      ...academicYearOps,
      ...classOps,
      ...sectionOps,
      ...coreOps,
      ...langOps,
    ]);

    const seeded = 3 + 10 + 30 + 5 + 17; // 65
    const context: RequestContext = {
      tenantId,
      userId,
      role: 'SCHOOL_ADMIN',
      correlationId: randomUUID(),
    };
    await this.publishAudit(
      context,
      'SEED',
      'School',
      tenantId,
      'PAN-India default setup seeded',
      { seeded, academicYears: 3, classes: 10, sections: 30, subjects: 22 },
    );
    return { seeded };
  }

  // â”€â”€ Report Card View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getStudentResult(examId: string, studentId: string, tenantId: string) {
    // Validate exam belongs to tenant
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, tenantId, softDelete: false },
      select: { id: true, name: true, classId: true },
    });
    if (!exam) throw new NotFoundException('[ERR-RES-4041] Exam not found');

    // Validate student belongs to tenant
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, softDelete: false },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    });
    if (!student) throw new NotFoundException('[ERR-RES-4042] Student not found');

    // Check whether results have been processed for this student/exam
    const aggregate = await this.prisma.studentExamAggregate.findFirst({
      where: { tenantId, examId, studentId, softDelete: false },
      select: { totalMarks: true, percentage: true, grade: true, classRank: true, sectionRank: true },
    });
    if (!aggregate) return null; // indicates "not yet processed"

    // Parallel fetch: per-subject marks + exam-subject max marks + enrollment (class/section names)
    const [marksRaw, examSubjectsRaw, enrollmentRaw] = await Promise.all([
      this.prisma.studentMark.findMany({
        where: { tenantId, examId, studentId, softDelete: false },
        include: { subject: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.examSubject.findMany({
        where: { tenantId, examId, softDelete: false },
        select: { subjectId: true, maxMarks: true },
      }),
      this.prisma.studentEnrollment.findFirst({
        where: { tenantId, studentId, classId: exam.classId, softDelete: false },
        include: {
          class:   { select: { name: true, code: true } },
          section: { select: { name: true } },
        },
      }),
    ]);

    const maxMarksBySubject: Record<string, number> = {};
    for (const es of examSubjectsRaw) maxMarksBySubject[es.subjectId] = es.maxMarks;

    return {
      student: {
        id:              student.id,
        firstName:       student.firstName,
        lastName:        student.lastName,
        admissionNumber: student.admissionNumber,
      },
      exam: { id: exam.id, name: exam.name },
      enrollment: {
        className:   enrollmentRaw?.class?.name   ?? 'â€”',
        classCode:   enrollmentRaw?.class?.code   ?? '',
        sectionName: enrollmentRaw?.section?.name ?? 'â€”',
      },
      aggregate: {
        totalMarks:  aggregate.totalMarks,
        percentage:  aggregate.percentage,
        grade:       aggregate.grade,
        classRank:   aggregate.classRank,
        sectionRank: aggregate.sectionRank,
      },
      subjectMarks: marksRaw.map((m) => ({
        subjectId:     m.subjectId,
        subjectName:   m.subject.name,
        subjectCode:   m.subject.code,
        maxMarks:      maxMarksBySubject[m.subjectId] ?? 0,
        marksObtained: m.marksObtained,
      })),
    };
  }

  // â”€â”€ ExamSchedule (Master Data) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * List exam schedules for a tenant partition.
   * Pass tenantId = 'MASTER_TEMPLATE' to list master template rows.
   */
  async listExamSchedules(tenantId: string): Promise<object[]> {
    return (this.prisma as any).examSchedule.findMany({
      where:   { tenantId, softDelete: false },
      orderBy: { startDate: 'asc' },
      select: {
        id: true, name: true, academicYearId: true, targetClasses: true,
        startDate: true, endDate: true, createdAt: true, updatedAt: true,
      },
    });
  }

  /**
   * Create an exam schedule entry in the given tenant partition.
   */
  async createExamSchedule(
    dto: CreateExamScheduleDto,
    context: RequestContext,
  ): Promise<{ id: string }> {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const { id } = await (this.prisma as any).examSchedule.create({
      data: {
        id:             randomUUID(),
        tenantId:       context.tenantId,
        name:           dto.name,
        academicYearId: dto.academicYearId ?? null,
        targetClasses:  dto.targetClasses  ?? 'ALL',
        startDate:      dto.startDate,
        endDate:        dto.endDate,
        createdBy:      context.userId,
        updatedBy:      context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'CREATE', 'ExamSchedule', id, `ExamSchedule "${dto.name}" created`);
    return { id };
  }

  /**
   * Update an exam schedule entry within the caller's tenant partition.
   */
  async updateExamSchedule(
    id: string,
    dto: UpdateExamScheduleDto,
    context: RequestContext,
  ): Promise<{ updated: boolean }> {
    const row = await (this.prisma as any).examSchedule.findFirst({
      where:  { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('ExamSchedule not found');

    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    await (this.prisma as any).examSchedule.update({
      where: { id },
      data:  {
        ...(dto.name           !== undefined && { name:          dto.name }),
        ...(dto.targetClasses  !== undefined && { targetClasses: dto.targetClasses }),
        ...(dto.startDate      !== undefined && { startDate:     dto.startDate }),
        ...(dto.endDate        !== undefined && { endDate:       dto.endDate }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });

    await this.publishAudit(context, 'UPDATE', 'ExamSchedule', id, `ExamSchedule "${id}" updated`);
    return { updated: true };
  }

  /**
   * Soft-delete an exam schedule entry within the caller's tenant partition.
   */
  async deleteExamSchedule(
    id: string,
    context: RequestContext,
  ): Promise<{ deleted: boolean }> {
    const row = await (this.prisma as any).examSchedule.findFirst({
      where:  { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('ExamSchedule not found');

    await (this.prisma as any).examSchedule.update({
      where: { id },
      data:  { softDelete: true, updatedBy: context.userId, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'ExamSchedule', id, `ExamSchedule "${id}" soft-deleted`);
    return { deleted: true };
  }

  /**
   * Copies all ExamSchedule rows from MASTER_TEMPLATE into the calling school's
   * tenant, linked to the specified academicYearId.
   * Skips duplicates (name already exists for that year) to keep the operation
   * idempotent.
   */
  async generateExamSchedulesFromMaster(
    academicYearId: string,
    context: RequestContext,
  ): Promise<{ generated: number }> {
    const MASTER = 'MASTER_TEMPLATE';

    const masterRows = await (this.prisma as any).examSchedule.findMany({
      where:   { tenantId: MASTER, softDelete: false },
      orderBy: { startDate: 'asc' },
    });
    if (masterRows.length === 0) {
      throw new BadRequestException('No master exam schedules found. Contact System Admin.');
    }

    // Validate the target academic year belongs to the tenant
    await this.assertEntityExists('AcademicYear', academicYearId, context.tenantId);

    // Skip names that already exist for this academicYear to keep it idempotent
    const existing = await (this.prisma as any).examSchedule.findMany({
      where:  { tenantId: context.tenantId, academicYearId, softDelete: false },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((r: any) => r.name));

    const toCreate = masterRows.filter((r: any) => !existingNames.has(r.name));
    if (toCreate.length === 0) {
      return { generated: 0 };
    }

    await this.prisma.$transaction(
      toCreate.map((m: any) =>
        (this.prisma as any).examSchedule.create({
          data: {
            id:             randomUUID(),
            tenantId:       context.tenantId,
            name:           m.name,
            academicYearId,
            targetClasses:  m.targetClasses,
            startDate:      m.startDate,
            endDate:        m.endDate,
            createdBy:      context.userId,
            updatedBy:      context.userId,
          },
        }),
      ),
    );

    await this.publishAudit(
      context, 'CREATE', 'ExamSchedule', context.tenantId,
      'Exam schedules generated from master template',
      { count: toCreate.length, academicYearId },
    );
    return { generated: toCreate.length };
  }
}