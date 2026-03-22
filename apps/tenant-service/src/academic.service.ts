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
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';
import { NamingStyle } from './dto/seed-sections.dto';
import { CreateStudentEnrollmentDto } from './dto/create-student-enrollment.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
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
import { SaveAttendanceLogDto } from './dto/save-attendance-log.dto';
import { BulkMarksDto } from './dto/create-bulk-marks.dto';
import { CreateGradeScaleDto } from './dto/create-grade-scale.dto';
import { UpdateGradeScaleDto } from './dto/update-grade-scale.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { CreateExamSubjectDto } from './dto/create-exam-subject.dto';
import { UpdateExamSubjectDto } from './dto/update-exam-subject.dto';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { UpdateExamScheduleDto } from './dto/update-exam-schedule.dto';
import {
  SaveWeekendConfigDto,
  SaveMatrixRulesDto,
  CreateHolidayEntryDto,
  UpdateHolidayEntryDto,
} from './dto/holiday-engine.dto';
import { TenantStatus } from './generated/prisma-client';
import { PrismaService } from './prisma/prisma.service';
import { StaffAuthService } from './staff-auth.service';
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
    private readonly staffAuth: StaffAuthService,
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
    const { id } = await this.prisma.section.create({
      data: {
        tenantId: context.tenantId,
        name: dto.name,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'CREATE', 'Section', id, 'Section created', { name: dto.name });
    return { id };
  }

  // -- Class Sections ---------------------------------------------------------

  async createClassSection(dto: CreateClassSectionDto, context: RequestContext): Promise<{ id: string }> {
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    await this.assertEntityExists('Section', dto.sectionId, context.tenantId);

    // Guard: duplicate assignment (same section to same class)
    const dupAssignment = await this.prisma.classSection.findFirst({
      where: { tenantId: context.tenantId, classId: dto.classId, sectionId: dto.sectionId, softDelete: false },
      select: { id: true },
    });
    if (dupAssignment) throw new ConflictException('[ERR-ACAD-CSC-4091] This section is already assigned to this class.');

    // Guard: duplicate display name within tenant
    const dupName = await this.prisma.classSection.findFirst({
      where: { tenantId: context.tenantId, name: dto.name.trim(), softDelete: false },
      select: { id: true },
    });
    if (dupName) throw new ConflictException('[ERR-ACAD-CSC-4092] A class-section with this display name already exists.');

    const { id } = await this.prisma.classSection.create({
      data: {
        tenantId: context.tenantId,
        classId: dto.classId,
        sectionId: dto.sectionId,
        name: dto.name,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(context, 'CREATE', 'ClassSection', id, 'Class-section created', { name: dto.name });
    return { id };
  }

  async listClassSections(tenantId: string, classId?: string): Promise<Array<{
    id: string; name: string; classId: string; className: string; sectionId: string; sectionName: string; createdAt: Date; updatedAt: Date;
  }>> {
    type Row = { id: string; name: string; classId: string; className: string; sectionId: string; sectionName: string; createdAt: Date; updatedAt: Date };

    if (classId) {
      return this.prisma.$queryRaw<Row[]>`
        SELECT cs."id", cs."name", cs."classId", c."name" AS "className",
               cs."sectionId", s."name" AS "sectionName", cs."createdAt", cs."updatedAt"
        FROM "ClassSection" cs
        JOIN "Class" c ON c."id" = cs."classId"
        JOIN "Section" s ON s."id" = cs."sectionId"
        WHERE cs."tenantId" = ${tenantId} AND cs."classId" = ${classId} AND cs."softDelete" = false
        ORDER BY cs."name" ASC
      `;
    }
    return this.prisma.$queryRaw<Row[]>`
      SELECT cs."id", cs."name", cs."classId", c."name" AS "className",
             cs."sectionId", s."name" AS "sectionName", cs."createdAt", cs."updatedAt"
      FROM "ClassSection" cs
      JOIN "Class" c ON c."id" = cs."classId"
      JOIN "Section" s ON s."id" = cs."sectionId"
      WHERE cs."tenantId" = ${tenantId} AND cs."softDelete" = false
      ORDER BY c."name" ASC, cs."name" ASC
    `;
  }

  async updateClassSection(id: string, dto: UpdateClassSectionDto, context: RequestContext): Promise<{ updated: boolean }> {
    const result = await this.prisma.classSection.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException('[ERR-ACAD-CSC-4041] Class-section not found');

    await this.publishAudit(context, 'UPDATE', 'ClassSection', id, 'Class-section updated', { ...dto });
    return { updated: true };
  }

  async deleteClassSection(id: string, context: RequestContext): Promise<{ deleted: boolean }> {
    const cs = await this.prisma.classSection.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!cs) throw new NotFoundException('[ERR-ACAD-CSC-4042] Class-section not found');

    await this.prisma.classSection.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(context, 'DELETE', 'ClassSection', id, 'Class-section soft-deleted', {});
    return { deleted: true };
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
    // Issue-225: Validate single parentId up-front
    if (dto.parentId) {
      const validParent = await this.prisma.parent.findFirst({
        where: { id: dto.parentId, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (!validParent) {
        throw new BadRequestException('[ERR-PSM-4001] parentId does not exist or does not belong to this tenant');
      }
    }

    // Issue-219: Single atomic transaction ï¿½ student row + parent mapping + enrollment
    // are all written together. No "orphan student" risk if enrollment fails.
    const { id } = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          tenantId: context.tenantId,
          admissionNumber: dto.admissionNumber,
          firstName: dto.firstName,
          ...(dto.middleName !== undefined && { middleName: dto.middleName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.preferredName !== undefined && { preferredName: dto.preferredName }),
          ...(dto.dateOfJoining !== undefined && { dateOfJoining: dto.dateOfJoining }),
          dateOfBirth: dto.dateOfBirth,
          gender: dto.gender as any,
          ...(dto.preferredGender !== undefined && { preferredGender: dto.preferredGender }),
          status: dto.status as any,
          ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup as any }),
          ...(dto.motherTongue !== undefined && { motherTongue: dto.motherTongue }),
          ...(dto.nationality !== undefined && { nationality: dto.nationality }),
          // Government & Compliance
          ...(dto.category !== undefined && { category: dto.category as any }),
          ...(dto.religion !== undefined && { religion: dto.religion as any }),
          ...(dto.caste !== undefined && { caste: dto.caste }),
          ...(dto.aadhaarMasked !== undefined && { aadhaarMasked: dto.aadhaarMasked }),
          ...(dto.apaarId !== undefined && { apaarId: dto.apaarId }),
          ...(dto.isRteAdmission !== undefined && { isRteAdmission: dto.isRteAdmission }),
          ...(dto.isCwsn !== undefined && { isCwsn: dto.isCwsn }),
          ...(dto.disabilityType !== undefined && { disabilityType: dto.disabilityType }),
          ...(dto.isBpl !== undefined && { isBpl: dto.isBpl }),
          ...(dto.isMinority !== undefined && { isMinority: dto.isMinority }),
          // Health & Emergency
          ...(dto.allergies !== undefined && { allergies: dto.allergies }),
          ...(dto.medicalConditions !== undefined && { medicalConditions: dto.medicalConditions }),
          ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact }),
          // Address
          ...(dto.previousSchool !== undefined && { previousSchool: dto.previousSchool }),
          ...(dto.tcNumber !== undefined && { tcNumber: dto.tcNumber }),
          ...(dto.addressLine !== undefined && { addressLine: dto.addressLine }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.pincode !== undefined && { pincode: dto.pincode }),
          ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
          createdBy: context.userId,
          updatedBy: context.userId,
        } as any,  // Issue-222: stale Prisma types until prisma generate runs after db push
        select: { id: true },
      });

      // Issue-225: Single parent mapping with relation
      if (dto.parentId) {
        await tx.parentStudentMapping.create({
          data: {
            tenantId: context.tenantId,
            parentId: dto.parentId,
            studentId: student.id,
            relation: (dto.parentRelation as any) ?? 'GUARDIAN',
            createdBy: context.userId,
            updatedBy: context.userId,
          } as any,
        });
      }

      // Issue-219: Atomically create enrollment inside the same transaction.
      if (dto.enrollment) {
        await tx.studentEnrollment.create({
          data: {
            tenantId: context.tenantId,
            studentId: student.id,
            academicYearId: dto.enrollment.academicYearId,
            classId: dto.enrollment.classId,
            // Issue-231: sectionId and rollNumber are optional
            ...(dto.enrollment.sectionId && { sectionId: dto.enrollment.sectionId }),
            ...(dto.enrollment.rollNumber && { rollNumber: dto.enrollment.rollNumber }),
            createdBy: context.userId,
            updatedBy: context.userId,
          } as any,  // Issue-231: stale Prisma types until prisma generate runs after db push
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

    // Validate departmentId and roleId for the Employee record
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId: context.tenantId, softDelete: false },
      });
      if (!dept) throw new BadRequestException('[ERR-TS-4010] Department not found');
    }
    if (dto.roleId) {
      const role = await this.prisma.employeeRole.findFirst({
        where: { id: dto.roleId, tenantId: context.tenantId, softDelete: false },
      });
      if (!role) throw new BadRequestException('[ERR-TS-4011] Employee role not found');
    }

    const id = randomUUID();
    const employeeId = randomUUID();

    // Hash DOB as default password (DDMMYYYY format)
    const passwordHash = await this.staffAuth.hashDateOfBirth(
      dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
    );

    // Atomic transaction: Employee backbone + Teacher extension + subject assignments
    await this.prisma.$transaction(async (tx) => {
      // FIRST: Create the unified Employee record
      await tx.employee.create({
        data: {
          id: employeeId,
          tenantId: context.tenantId,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          contactPhone: dto.phone ?? null,
          email: dto.email ?? null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
          passwordHash,
          requiresPasswordChange: true,
          departmentId: dto.departmentId,
          roleId: dto.roleId,
          isActive: dto.isActive ?? true,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
      });

      // SECOND: Create the Teacher extension linked to the Employee
      await tx.teacher.create({
        data: {
          id,
          tenantId: context.tenantId,
          employeeId,
          userId: dto.userId ?? undefined,
          employeeCode: dto.employeeCode,
          designation: dto.designation,
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

    await this.publishAudit(context, 'CREATE', 'Teacher', id, 'Teacher created', { employeeCode: dto.employeeCode, employeeId });
    return { id };
  }

  async listTeachers(tenantId: string): Promise<Array<{
    id: string; firstName: string | null; lastName: string | null; email: string | null;
    contactPhone: string | null; dateOfBirth: Date | null; dateOfJoining: Date | null;
    employeeCode: string; designation: string;
    isActive: boolean; createdAt: Date; updatedAt: Date;
    subjects: { id: string; name: string; code: string; }[];
  }>> {
    const rows = await this.prisma.teacher.findMany({
      where: { tenantId, softDelete: false },
      select: {
        id: true, employeeCode: true, designation: true,
        isActive: true, createdAt: true, updatedAt: true,
        employee: {
          select: { firstName: true, lastName: true, email: true, contactPhone: true, dateOfBirth: true, dateOfJoining: true },
        },
        teacherSubjects: {
          where: { subject: { softDelete: false } },
          select: { subject: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });
    return rows.map(({ teacherSubjects, employee, ...rest }) => ({
      ...rest,
      firstName: employee?.firstName ?? null,
      lastName: employee?.lastName ?? null,
      email: employee?.email ?? null,
      contactPhone: employee?.contactPhone ?? null,
      dateOfBirth: employee?.dateOfBirth ?? null,
      dateOfJoining: employee?.dateOfJoining ?? null,
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

    // Single atomic transaction: teacher update + Employee PII sync + subject replacement.
    await this.prisma.$transaction(async (tx) => {
      // Find the teacher and its employee link
      const teacher = await tx.teacher.findFirst({
        where: { id, tenantId: context.tenantId, softDelete: false },
        select: { id: true, employeeId: true },
      });
      if (!teacher) throw new NotFoundException('[ERR-FAC-4041] Teacher not found');

      // Update Teacher extension fields
      await tx.teacher.update({
        where: { id },
        data: {
          ...(dto.employeeCode !== undefined && { employeeCode: dto.employeeCode }),
          ...(dto.designation !== undefined && { designation: dto.designation }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          updatedBy: context.userId,
          updatedAt: new Date(),
        },
      });

      // Sync PII changes to the Employee backbone
      if (teacher.employeeId && (dto.firstName !== undefined || dto.lastName !== undefined || dto.email !== undefined || dto.phone !== undefined || dto.dateOfBirth !== undefined || dto.dateOfJoining !== undefined)) {
        await tx.employee.update({
          where: { id: teacher.employeeId },
          data: {
            ...(dto.firstName !== undefined && { firstName: dto.firstName }),
            ...(dto.lastName !== undefined && { lastName: dto.lastName }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.phone !== undefined && { contactPhone: dto.phone }),
            ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
            ...(dto.dateOfJoining !== undefined && { dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null }),
            updatedBy: context.userId,
          },
        });
      }

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

  /** Fetch a single academic year's date range — used for calendar CSV validation. */
  async getAcademicYearById(
    tenantId: string,
    id: string,
  ): Promise<{ name: string; startDate: Date; endDate: Date } | null> {
    return this.prisma.academicYear.findFirst({
      where: { id, tenantId, softDelete: false },
      select: { name: true, startDate: true, endDate: true },
    });
  }

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

  async seedClasses(context: RequestContext, academicYearId?: string): Promise<{ seeded: number }> {
    // -- Step 1: Resolve the target academic year ----------------------------------------
    let activeYear: { id: string; name: string } | null = null;
    if (academicYearId) {
      activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId: context.tenantId, id: academicYearId, softDelete: false },
        select: { id: true, name: true },
      });
      if (!activeYear) throw new BadRequestException(`No Academic Year found with id: ${academicYearId}.`);
    } else {
      activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId: context.tenantId, isActive: true, softDelete: false },
        select: { id: true, name: true },
      });
      if (!activeYear) throw new BadRequestException('No active Academic Year found. Please seed Academic Years first before seeding Classes.');
    }
    // -- Step 2: Zombie cleanup - scoped to target academic year
    await this.prisma.class.deleteMany({
      where: { tenantId: context.tenantId, academicYearId: activeYear.id, softDelete: true },
    });
    // -- Step 3: Idempotency guard - per academic year
    const existing = await this.prisma.class.count({
      where: { tenantId: context.tenantId, academicYearId: activeYear.id, softDelete: false },
    });
    if (existing > 0) {
      throw new ConflictException(`Classes already exist for ${activeYear.name}. Delete them first to re-seed.`);
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
    const ALPHABETIC_NAMES = ['A','B','C','D','E'].map((l) => `Section ${l}`);
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

  async listSections(tenantId: string): Promise<Array<{
    id: string; name: string; createdAt: Date; updatedAt: Date;
  }>> {
    return this.prisma.section.findMany({
      where: { tenantId, softDelete: false },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
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
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      ORDER BY "status" DESC, "name" ASC
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
        // Issue-217: include active enrollment (class/section/year/rollNumber) and parent names
        enrollments: {
          where: { softDelete: false },
          select: {
            id: true,
            rollNumber: true,
            class:        { select: { id: true, name: true, code: true } },
            section:      { select: { id: true, name: true } },
            academicYear: { select: { id: true, name: true, isActive: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        parentMappings: {
          where: { softDelete: false },
          select: {
            relation: true,  // Issue-225: per-mapping relation
            parent: { select: { id: true, firstName: true, lastName: true, relation: true } },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  // Issue-238b: Returns all scalar fields + enrollments + parentMappings for edit-mode hydration.
  async getStudent(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId, softDelete: false },
      include: {
        enrollments: {
          where: { softDelete: false },
          select: {
            id: true,
            rollNumber: true,
            class:        { select: { id: true, name: true, code: true } },
            section:      { select: { id: true, name: true } },
            academicYear: { select: { id: true, name: true, isActive: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        parentMappings: {
          where: { softDelete: false },
          select: {
            relation: true,
            parent: { select: { id: true, firstName: true, lastName: true, relation: true } },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('[ERR-STU-4041] Student not found');
    return student;
  }

  async updateStudent(id: string, dto: UpdateStudentDto, context: RequestContext): Promise<{ updated: boolean }> {
    // Validate parents up-front (outside the transaction) so we fail fast with a clear error.
    // Issue-225: Validate single parentId up-front
    if (dto.parentId) {
      const validParent = await this.prisma.parent.findFirst({
        where: { id: dto.parentId, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (!validParent) {
        throw new BadRequestException('[ERR-PSM-4001] parentId does not exist or does not belong to this tenant');
      }
    }

    // Issue-219: Validate enrollment foreign keys up-front so we fail fast before the transaction.
    if (dto.enrollment) {
      await this.assertEnrollmentEntitiesExist(dto.enrollment, context.tenantId);
    }

    // Issue-219: Single atomic transaction ï¿½ student update + parent mapping replacement + enrollment upsert.
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.student.updateMany({
        where: { id, tenantId: context.tenantId, softDelete: false },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.middleName !== undefined && { middleName: dto.middleName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.preferredName !== undefined && { preferredName: dto.preferredName }),
          ...(dto.dateOfJoining !== undefined && { dateOfJoining: dto.dateOfJoining }),
          ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth }),
          ...(dto.gender !== undefined && { gender: dto.gender as any }),
          ...(dto.preferredGender !== undefined && { preferredGender: dto.preferredGender }),
          ...(dto.status !== undefined && { status: dto.status as any }),
          ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup as any }),
          ...(dto.motherTongue !== undefined && { motherTongue: dto.motherTongue }),
          ...(dto.nationality !== undefined && { nationality: dto.nationality }),
          ...(dto.category !== undefined && { category: dto.category as any }),
          ...(dto.religion !== undefined && { religion: dto.religion as any }),
          ...(dto.caste !== undefined && { caste: dto.caste }),
          ...(dto.aadhaarMasked !== undefined && { aadhaarMasked: dto.aadhaarMasked }),
          ...(dto.apaarId !== undefined && { apaarId: dto.apaarId }),
          ...(dto.isRteAdmission !== undefined && { isRteAdmission: dto.isRteAdmission }),
          ...(dto.isCwsn !== undefined && { isCwsn: dto.isCwsn }),
          ...(dto.disabilityType !== undefined && { disabilityType: dto.disabilityType }),
          ...(dto.isBpl !== undefined && { isBpl: dto.isBpl }),
          ...(dto.isMinority !== undefined && { isMinority: dto.isMinority }),
          ...(dto.allergies !== undefined && { allergies: dto.allergies }),
          ...(dto.medicalConditions !== undefined && { medicalConditions: dto.medicalConditions }),
          ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact }),
          ...(dto.previousSchool !== undefined && { previousSchool: dto.previousSchool }),
          ...(dto.tcNumber !== undefined && { tcNumber: dto.tcNumber }),
          ...(dto.addressLine !== undefined && { addressLine: dto.addressLine }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.pincode !== undefined && { pincode: dto.pincode }),
          ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
          ...(dto.dateOfLeaving !== undefined && { dateOfLeaving: dto.dateOfLeaving }),
          ...(dto.leavingReason !== undefined && { leavingReason: dto.leavingReason }),
          updatedBy: context.userId,
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) throw new NotFoundException('[ERR-STU-4042] Student not found');

      // Issue-225: When parentId is explicitly sent (even as null), atomically replace mapping.
      if (dto.parentId !== undefined) {
        await tx.parentStudentMapping.deleteMany({ where: { studentId: id, tenantId: context.tenantId } });
        if (dto.parentId) {
          await tx.parentStudentMapping.create({
            data: {
              tenantId: context.tenantId,
              parentId: dto.parentId,
              studentId: id,
              relation: (dto.parentRelation as any) ?? 'GUARDIAN',
              createdBy: context.userId,
              updatedBy: context.userId,
            } as any,
          });
        }
      }

      // Issue-219: Atomically upsert enrollment inside the same transaction.
      // Uses the unique constraint [tenantId, studentId, academicYearId] as the upsert key.
      if (dto.enrollment) {
        await tx.studentEnrollment.upsert({
          where: {
            tenantId_studentId_academicYearId: {
              tenantId: context.tenantId,
              studentId: id,
              academicYearId: dto.enrollment.academicYearId,
            },
          },
          create: {
            tenantId: context.tenantId,
            studentId: id,
            academicYearId: dto.enrollment.academicYearId,
            classId: dto.enrollment.classId,
            // Issue-231: sectionId and rollNumber are optional
            ...(dto.enrollment.sectionId !== undefined && { sectionId: dto.enrollment.sectionId }),
            ...(dto.enrollment.rollNumber !== undefined && { rollNumber: dto.enrollment.rollNumber }),
            createdBy: context.userId,
            updatedBy: context.userId,
          } as any,  // Issue-231: stale Prisma types until prisma generate runs after db push
          update: {
            classId: dto.enrollment.classId,
            ...(dto.enrollment.sectionId !== undefined && { sectionId: dto.enrollment.sectionId }),
            ...(dto.enrollment.rollNumber !== undefined && { rollNumber: dto.enrollment.rollNumber }),
            updatedBy: context.userId,
            updatedAt: new Date(),
          },
        });
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
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, email: true, contactPhone: true, dateOfBirth: true, dateOfJoining: true } },
      },
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

  async listEnrollments(tenantId: string, studentId?: string, academicYearId?: string, classId?: string, sectionId?: string) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        softDelete: false,
        ...(studentId && { studentId }),
        ...(academicYearId && { academicYearId }),
        ...(classId && { classId }),
        ...(sectionId && { sectionId }),
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
        gender: true, phone: true, email: true,
        addressLine: true, city: true, state: true, pincode: true,
        createdAt: true, updatedAt: true,
        // Issue-217: include linked students (wards) for the Wards column
        studentMappings: {
          where: { softDelete: false },
          select: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          },
        },
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
    // Issue-222: Validate students up-front if provided for bidirectional linking
    if (dto.studentIds?.length) {
      const validStudents = await this.prisma.student.findMany({
        where: { id: { in: dto.studentIds }, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (validStudents.length !== dto.studentIds.length) {
        throw new BadRequestException(
          '[ERR-PSM-4002] One or more studentIds do not exist or do not belong to this tenant',
        );
      }
    }

    const id = randomUUID();
    // Issue-222: Wrap in $transaction to atomically create parent + student mappings
    await this.prisma.$transaction(async (tx) => {
      await tx.parent.create({
        data: {
          id,
          tenantId: context.tenantId,
          userId: dto.userId,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,  // nullable after Issue-222 schema change
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
        } as any,  // Issue-222: cast until `prisma generate` refreshes types after db push
      });
      if (dto.studentIds?.length) {
        await tx.parentStudentMapping.createMany({
          data: dto.studentIds.map((studentId) => ({
            tenantId: context.tenantId,
            parentId: id,
            studentId,
            createdBy: context.userId,
            updatedBy: context.userId,
          })),
        });
      }
    });

    await this.publishAudit(context, 'CREATE', 'Parent', id, 'Parent created', { userId: dto.userId });
    return { id };
  }

  async updateParent(id: string, dto: UpdateParentDto, context: RequestContext): Promise<{ updated: boolean }> {
    // Issue-222: Validate students up-front if provided for bidirectional linking
    if (dto.studentIds !== undefined && dto.studentIds.length > 0) {
      const validStudents = await this.prisma.student.findMany({
        where: { id: { in: dto.studentIds }, tenantId: context.tenantId, softDelete: false },
        select: { id: true },
      });
      if (validStudents.length !== dto.studentIds.length) {
        throw new BadRequestException(
          '[ERR-PSM-4002] One or more studentIds do not exist or do not belong to this tenant',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.parent.updateMany({
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
          // Issue-231 Gap 3: Missing fields added to PATCH write
          ...(dto.knownLanguages !== undefined && { knownLanguages: dto.knownLanguages }),
          ...(dto.annualIncomeSlab !== undefined && { annualIncomeSlab: dto.annualIncomeSlab }),
          ...(dto.education !== undefined && { education: dto.education }),
          ...(dto.aadhaarMasked !== undefined && { aadhaarMasked: dto.aadhaarMasked }),
          ...(dto.addressLine !== undefined && { addressLine: dto.addressLine }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.pincode !== undefined && { pincode: dto.pincode }),
          updatedBy: context.userId,
          updatedAt: new Date(),
        },
      });
      if (result.count === 0) throw new NotFoundException('[ERR-PAR-4042] Parent not found');

      // Issue-222: When studentIds is explicitly provided, atomically replace all mappings.
      if (dto.studentIds !== undefined) {
        await tx.parentStudentMapping.deleteMany({
          where: { parentId: id, tenantId: context.tenantId },
        });
        if (dto.studentIds.length > 0) {
          await tx.parentStudentMapping.createMany({
            data: dto.studentIds.map((studentId) => ({
              tenantId: context.tenantId,
              parentId: id,
              studentId,
              createdBy: context.userId,
              updatedBy: context.userId,
            })),
          });
        }
      }
    });

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

  // -- seed-from-master: Academic Years ----------------------------------------
  /**
   * Copies all academic years from MASTER_TEMPLATE into the calling school's tenant.
   * The active/inactive flags are preserved. Throws if master is empty or school already has years.
   */
  async seedAcademicYearsFromMaster(context: RequestContext): Promise<{ seeded: number }> {
    const MASTER = 'MASTER_TEMPLATE';

    const masterRows = await this.prisma.academicYear.findMany({
      where: { tenantId: MASTER, softDelete: false },
      orderBy: { startDate: 'asc' },
    });
    if (masterRows.length === 0) {
      throw new BadRequestException('Master template Academic Years not configured. Contact System Admin.');
    }

    // Zombie cleanup + idempotency guard
    await this.prisma.academicYear.deleteMany({ where: { tenantId: context.tenantId, softDelete: true } });
    const existing = await this.prisma.academicYear.count({ where: { tenantId: context.tenantId, softDelete: false } });
    if (existing > 0) {
      throw new ConflictException('Academic Years already exist for this school. Delete them first to re-seed.');
    }

    const data = masterRows.map((m) => ({
      id:        randomUUID(),
      tenantId:  context.tenantId,
      name:      m.name,
      startDate: m.startDate,
      endDate:   m.endDate,
      isActive:  m.isActive,
      createdBy: context.userId,
      updatedBy: context.userId,
    }));

    const result = await this.prisma.academicYear.createMany({ data, skipDuplicates: true });
    await this.publishAudit(context, 'SEED', 'AcademicYear', context.tenantId,
      'Academic Years seeded from master template', { count: result.count });
    return { seeded: result.count };
  }

  // -- seed-from-master: Classes ------------------------------------------------
  /**
   * Copies all classes from MASTER_TEMPLATE into the calling school's tenant,
   * linking them to the school's active academic year.
   * Throws if master is empty, school has no active year, or school already has classes.
   */
  async seedClassesFromMaster(context: RequestContext, academicYearId?: string): Promise<{ seeded: number }> {
    const MASTER = 'MASTER_TEMPLATE';

    const masterRows = await this.prisma.class.findMany({
      where: { tenantId: MASTER, softDelete: false },
      orderBy: { name: 'asc' },
    });
    if (masterRows.length === 0) {
      throw new BadRequestException('Master template Classes not configured. Contact System Admin.');
    }

    // Resolve the target academic year (explicit or active)
    let activeYear: { id: string; name: string } | null = null;
    if (academicYearId) {
      activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId: context.tenantId, id: academicYearId, softDelete: false },
        select: { id: true, name: true },
      });
      if (!activeYear) throw new BadRequestException(`No Academic Year found with id: ${academicYearId}.`);
    } else {
      activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId: context.tenantId, isActive: true, softDelete: false },
        select: { id: true, name: true },
      });
      if (!activeYear) {
        throw new BadRequestException('No active Academic Year found for this school. Generate from Master first.');
      }
    }

    // Zombie cleanup — scoped to target academic year only
    await this.prisma.class.deleteMany({
      where: { tenantId: context.tenantId, academicYearId: activeYear.id, softDelete: true },
    });
    // Idempotency guard — scoped to target academic year
    const existing = await this.prisma.class.count({
      where: { tenantId: context.tenantId, academicYearId: activeYear.id, softDelete: false },
    });
    if (existing > 0) {
      throw new ConflictException(`Classes already exist for ${activeYear.name}. Delete them first to re-seed.`);
    }

    const data = masterRows.map((m) => ({
      id:             randomUUID(),
      tenantId:       context.tenantId,
      name:           m.name,
      code:           m.code,
      academicYearId: activeYear.id,
      createdBy:      context.userId,
      updatedBy:      context.userId,
    }));

    const result = await this.prisma.class.createMany({ data, skipDuplicates: true });
    await this.publishAudit(context, 'SEED', 'Class', context.tenantId,
      `Classes seeded from master template ? academic year ${activeYear.name}`, { count: result.count });
    return { seeded: result.count };
  }

  // -- seed-from-master: Sections -----------------------------------------------
  /**
   * Copies the master template section pool into this school's section pool (classId = NULL).
   * Throws if master is empty or school already has pool sections.
   */
  async seedSectionsFromMaster(context: RequestContext): Promise<{ seeded: number }> {
    const MASTER = 'MASTER_TEMPLATE';

    const masterRows = await this.prisma.section.findMany({
      where: { tenantId: MASTER, softDelete: false, classId: null },
      orderBy: { name: 'asc' },
    });
    if (masterRows.length === 0) {
      throw new BadRequestException('Master template Sections not configured. Contact System Admin.');
    }

    // Zombie cleanup ï¿½ pool sections only (classId IS NULL)
    await this.prisma.$executeRaw`
      DELETE FROM "Section"
      WHERE "tenantId" = ${context.tenantId}
        AND "classId" IS NULL
        AND "softDelete" = true
    `;
    const [{ count: existing }] = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM "Section"
      WHERE "tenantId" = ${context.tenantId}
        AND "classId" IS NULL
        AND "softDelete" = false
    `;
    if (existing > 0n) {
      throw new ConflictException('Section pool already exists for this school. Delete them first to re-seed.');
    }

    let seeded = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const m of masterRows) {
        const id = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "Section" ("id", "tenantId", "name", "classId", "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt")
          VALUES (${id}, ${context.tenantId}, ${m.name}, NULL, ${context.userId}, ${context.userId}, false, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `;
        seeded++;
      }
    });

    await this.publishAudit(context, 'SEED', 'Section', context.tenantId,
      'Sections seeded from master template', { count: seeded });
    return { seeded };
  }

  // -- seed-from-master: Subjects -----------------------------------------------
  /**
   * Copies all subjects from MASTER_TEMPLATE into the calling school's tenant,
   * preserving subject name, code and status.
   * Throws if master is empty or school already has subjects.
   */
  async seedSubjectsFromMaster(context: RequestContext): Promise<{ seeded: number }> {
    const MASTER = 'MASTER_TEMPLATE';

    const masterRows = await this.prisma.subject.findMany({
      where: { tenantId: MASTER, softDelete: false },
      orderBy: { name: 'asc' },
    });
    if (masterRows.length === 0) {
      throw new BadRequestException('Master template Subjects not configured. Contact System Admin.');
    }

    await this.prisma.subject.deleteMany({ where: { tenantId: context.tenantId, softDelete: true } });
    const existing = await this.prisma.subject.count({ where: { tenantId: context.tenantId, softDelete: false } });
    if (existing > 0) {
      throw new ConflictException('Subjects already exist for this school. Delete them first to re-seed.');
    }

    const data = masterRows.map((m) => ({
      id:        randomUUID(),
      tenantId:  context.tenantId,
      name:      m.name,
      code:      m.code,
      status:    m.status,
      createdBy: context.userId,
      updatedBy: context.userId,
    }));

    const result = await this.prisma.subject.createMany({ data: data as any[], skipDuplicates: true });
    await this.publishAudit(context, 'SEED', 'Subject', context.tenantId,
      'Subjects seeded from master template', { count: result.count });
    return { seeded: result.count };
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

  /**
   * Issue-219: Validates all three FK references (academicYearId, classId, sectionId) that are
   * embedded in an EnrollStudentDto before opening the atomic transaction. Calling this outside
   * the transaction avoids long-running locks while still producing clear, actionable errors.
   */
  private async assertEnrollmentEntitiesExist(enrollment: EnrollStudentDto, tenantId: string): Promise<void> {
    await this.assertEntityExists('AcademicYear', enrollment.academicYearId, tenantId);
    await this.assertEntityExists('Class', enrollment.classId, tenantId);
    // Issue-231: Section is optional ï¿½ only validate if provided
    if (enrollment.sectionId) {
      await this.assertEntityExists('Section', enrollment.sectionId, tenantId);
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

  // -- Event-Blob Attendance (High-Performance One-Row-Per-Class-Per-Day) ------

  /**
   * Saves or updates the daily attendance log using an Event-Blob (TEXT) field.
   * One row per class/section per day ï¿½ the entire student+teacher attendance
   * map is serialized as JSON in a single TEXT column.
   */
  async saveAttendanceLog(
    dto: SaveAttendanceLogDto,
    context: RequestContext,
  ): Promise<{ id: string; created: boolean }> {
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    await this.assertEntityExists('Section', dto.sectionId, context.tenantId);
    await this.assertEntityExists('AcademicYear', dto.academicYearId, context.tenantId);

    // Validate JSON blob structure and auto-inject teacher swipe-in times
    let blobStr = dto.attendanceBlob;
    try {
      const parsed = JSON.parse(blobStr);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new BadRequestException('[ERR-ATL-4001] attendanceBlob must be a JSON object');
      }
      // Server-side teacher swipe-time governance:
      // - Replace "AUTO" sentinel with authoritative server timestamp
      // - Clear swipe fields when teacher is Absent
      if (parsed.teachers && typeof parsed.teachers === 'object') {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const serverTime = `${hh}:${mm}`;
        for (const tId of Object.keys(parsed.teachers)) {
          const t = parsed.teachers[tId];
          if (!t) continue;

          // Absent teachers must not carry stale swipe data
          if (t.s === 'A') {
            delete t.in;
            delete t.out;
            continue;
          }

          // Replace AUTO sentinels with server time
          if (!t.in || t.in === 'AUTO') {
            t.in = serverTime;
          }
          if (t.out === 'AUTO') {
            t.out = serverTime;
          }
        }
        blobStr = JSON.stringify(parsed);
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('[ERR-ATL-4002] attendanceBlob is not valid JSON');
    }

    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    const existing = await this.prisma.attendanceLog.findFirst({
      where: {
        tenantId: context.tenantId,
        date,
        classId: dto.classId,
        sectionId: dto.sectionId,
        softDelete: false,
      },
      select: { id: true, status: true },
    });

    // Prevent modifications to locked attendance
    if (existing?.status === 1) {
      throw new BadRequestException('[ERR-ATL-4003] Attendance is locked and cannot be modified');
    }

    let logId: string;
    let created: boolean;

    if (existing) {
      await this.prisma.attendanceLog.update({
        where: { id: existing.id },
        data: {
          attendanceBlob: blobStr,
          status: dto.status ?? 0,
          updatedBy: context.userId,
        },
      });
      logId = existing.id;
      created = false;
    } else {
      const log = await this.prisma.attendanceLog.create({
        data: {
          tenantId: context.tenantId,
          date,
          classId: dto.classId,
          sectionId: dto.sectionId,
          academicYearId: dto.academicYearId,
          attendanceBlob: blobStr,
          status: dto.status ?? 0,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        select: { id: true },
      });
      logId = log.id;
      created = true;
    }

    await this.publishAudit(context, created ? 'CREATE' : 'UPDATE', 'AttendanceLog', logId,
      `Attendance log ${created ? 'created' : 'updated'}`, {
        date: dto.date, classId: dto.classId, sectionId: dto.sectionId,
      },
    );

    return { id: logId, created };
  }

  /**
   * Retrieves a daily attendance log by date + class + section.
   * Returns the JSON blob, lock status, and holiday info if found.
   */
  async getAttendanceLog(
    tenantId: string,
    date: string,
    classId: string,
    sectionId: string,
  ) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    const log = await this.prisma.attendanceLog.findFirst({
      where: { tenantId, date: d, classId, sectionId, softDelete: false },
      select: {
        id: true, date: true, classId: true, sectionId: true,
        academicYearId: true, attendanceBlob: true, status: true,
        createdAt: true, updatedAt: true,
      },
    });

    // Look up holiday status for this date
    let holidayInfo: {
      isHoliday: boolean; isFullDay: boolean; isFirstHalf: boolean;
      isSecondHalf: boolean; occasion: string; type: string; source: string;
    } | null = null;

    // Determine academicYearId: from the log if exists, else from class
    let ayId = log?.academicYearId ?? '';
    if (!ayId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: classId, tenantId, softDelete: false },
        select: { academicYearId: true },
      });
      ayId = cls?.academicYearId ?? '';
    }

    if (ayId) {
      holidayInfo = await this.getHolidayStatus(tenantId, ayId, date);
    }

    return { ...log, holidayInfo };
  }

  /**
   * Locks (or unlocks) a daily attendance log to prevent tampering.
   * status = 1 ? locked, status = 0 ? draft (unlock).
   */
  async lockAttendanceLog(
    tenantId: string,
    logId: string,
    lock: boolean,
    userId: string,
  ): Promise<{ id: string; status: number }> {
    const log = await this.prisma.attendanceLog.findFirst({
      where: { id: logId, tenantId, softDelete: false },
      select: { id: true, status: true },
    });
    if (!log) throw new NotFoundException('[ERR-ATL-4041] Attendance log not found');

    const newStatus = lock ? 1 : 0;
    await this.prisma.attendanceLog.update({
      where: { id: logId },
      data: { status: newStatus, updatedBy: userId },
    });

    return { id: logId, status: newStatus };
  }

  /**
   * Attendance Report Aggregation Engine.
   * Scans locked AttendanceLog blobs within a date range for a given class+section,
   * aggregates per-student status counts, and computes attendance percentages.
   */
  async getAttendanceReport(
    tenantId: string,
    classId: string,
    sectionId: string,
    startDate: string,
    endDate: string,
    viewType: 'students' | 'teachers' = 'students',
  ) {
    const from = new Date(startDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(endDate);
    to.setUTCHours(23, 59, 59, 999);

    // Fetch all locked attendance logs in the date range for this class+section
    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        tenantId,
        classId,
        sectionId,
        date: { gte: from, lte: to },
        status: 1, // only locked days count as working days
        softDelete: false,
      },
      select: { date: true, attendanceBlob: true, academicYearId: true },
      orderBy: { date: 'asc' },
    });

    // Determine academicYearId for holiday lookups
    const ayId = logs[0]?.academicYearId ?? '';

    // Fetch holiday map for the date range (Full-day holidays = 0 working days, Half-day = 0.5)
    const holidayMap = ayId
      ? await this.getHolidayMap(tenantId, ayId, from, to)
      : new Map<string, { isFullDay: boolean; isFirstHalf: boolean; isSecondHalf: boolean }>();

    // Filter out full-day holidays — keep half-day holidays (they still count partially)
    const workingLogs = logs.filter((log) => {
      const dateKey = new Date(log.date).toISOString().slice(0, 10);
      const hol = holidayMap.get(dateKey);
      if (hol && hol.isFullDay) return false; // exclude full-day holidays
      return true;
    });

    // Calculate total working days: non-holiday logs count as 1, half-day holidays count as 0.5
    let totalWorkingDays = 0;
    for (const log of workingLogs) {
      const dateKey = new Date(log.date).toISOString().slice(0, 10);
      const hol = holidayMap.get(dateKey);
      if (hol && (hol.isFirstHalf || hol.isSecondHalf) && !hol.isFullDay) {
        totalWorkingDays += 0.5;
      } else {
        totalWorkingDays += 1;
      }
    }
    const isSingleDay = startDate === endDate;

    // For Day view: also fetch unlocked (draft) entry to show with watermark
    let draftLog: { date: Date; attendanceBlob: string } | null = null;
    if (isSingleDay && workingLogs.length === 0) {
      draftLog = await this.prisma.attendanceLog.findFirst({
        where: {
          tenantId,
          classId,
          sectionId,
          date: { gte: from, lte: to },
          status: 0,
          softDelete: false,
        },
        select: { date: true, attendanceBlob: true },
      });
    }
    // The effective single-day log (locked takes priority, then draft)
    const dayLog = workingLogs.length > 0 ? workingLogs[0] : draftLog;
    const isDraft = workingLogs.length === 0 && draftLog !== null;

    // Get class and section names (common for both views)
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId, softDelete: false },
      select: { name: true, academicYear: { select: { name: true } } },
    });
    const sec = await this.prisma.classSection.findFirst({
      where: { classId, sectionId, softDelete: false },
      select: { name: true },
    });

    const common = {
      totalWorkingDays,
      className: cls?.name ?? '',
      sectionName: sec?.name ?? '',
      academicYearName: cls?.academicYear?.name ?? '',
      ...(isSingleDay ? { isDraft } : {}),
    };

    // -- Teacher report -----------------------------------------------------
    if (viewType === 'teachers') {
      const teachers = await this.prisma.teacher.findMany({
        where: { tenantId, softDelete: false },
        select: { id: true, employeeCode: true, employee: { select: { firstName: true, lastName: true } } },
      });

      type TKey = 'P' | 'OD' | 'SL' | 'CL' | 'A';
      const tCounters = new Map<string, Record<TKey, number>>();
      const swipeInArr = new Map<string, number[]>();
      const swipeOutArr = new Map<string, number[]>();

      for (const t of teachers) {
        tCounters.set(t.id, { P: 0, OD: 0, SL: 0, CL: 0, A: 0 });
        swipeInArr.set(t.id, []);
        swipeOutArr.set(t.id, []);
      }

      for (const log of workingLogs) {
        try {
          const blob = JSON.parse(log.attendanceBlob);
          const tchrs = blob?.teachers as Record<string, { s?: string; in?: string; out?: string }> | undefined;
          if (!tchrs) continue;
          for (const [tId, entry] of Object.entries(tchrs)) {
            const c = tCounters.get(tId);
            if (!c) continue;
            const status = entry?.s as TKey | undefined;
            if (status && status in c) c[status]++;
            if (entry?.in) {
              const m = timeToMins(entry.in);
              if (!isNaN(m)) swipeInArr.get(tId)!.push(m);
            }
            if (entry?.out) {
              const m = timeToMins(entry.out);
              if (!isNaN(m)) swipeOutArr.get(tId)!.push(m);
            }
          }
        } catch { /* skip malformed blobs */ }
      }

      const avgTime = (mins: number[]): string => {
        if (mins.length === 0) return '--';
        const avg = Math.round(mins.reduce((s, v) => s + v, 0) / mins.length);
        const h = Math.floor(avg / 60);
        const m = avg % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      const teacherRows = teachers
        .filter((t) => t.employee?.firstName)
        .map((t) => {
          const c = tCounters.get(t.id) ?? { P: 0, OD: 0, SL: 0, CL: 0, A: 0 };
          const row: Record<string, unknown> = {
            teacherId: t.id,
            employeeCode: t.employeeCode ?? '',
            teacherName: `${t.employee?.firstName ?? ''} ${t.employee?.lastName ?? ''}`.trim(),
            ...c,
            avgSwipeIn: avgTime(swipeInArr.get(t.id) ?? []),
            avgSwipeOut: avgTime(swipeOutArr.get(t.id) ?? []),
          };
          if (isSingleDay && dayLog) {
            try {
              const blob = JSON.parse(dayLog.attendanceBlob);
              const entry = blob?.teachers?.[t.id];
              row.dayStatus = entry?.s ?? '--';
              row.swipeIn = entry?.in ?? '--';
              row.swipeOut = entry?.out ?? '--';
            } catch { /* skip */ }
          }
          return row;
        });

      return { ...common, teacherRows };
    }

    // -- Student report (default) -------------------------------------------
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, classId, sectionId, softDelete: false },
      select: {
        studentId: true,
        rollNumber: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Aggregate status counts per student
    type StatusKey = 'P' | 'OD' | 'SL' | 'CL' | 'HL' | 'H' | 'A';
    const counters = new Map<string, Record<StatusKey, number>>();

    for (const enr of enrollments) {
      counters.set(enr.studentId, { P: 0, OD: 0, SL: 0, CL: 0, HL: 0, H: 0, A: 0 });
    }

    for (const log of workingLogs) {
      try {
        const blob = JSON.parse(log.attendanceBlob);
        const students = blob?.students as Record<string, { s?: string }> | undefined;
        if (!students) continue;
        for (const [studentId, entry] of Object.entries(students)) {
          const c = counters.get(studentId);
          if (!c) continue;
          const status = entry?.s as StatusKey | undefined;
          if (status && status in c) {
            c[status]++;
          }
        }
      } catch {
        // Skip malformed blobs
      }
    }

    // Build rows sorted by roll number
    const rows = enrollments
      .map((enr) => {
        const c = counters.get(enr.studentId) ?? { P: 0, OD: 0, SL: 0, CL: 0, HL: 0, H: 0, A: 0 };
        // H (Holiday) days are not counted as attendance — they are system-assigned school closures
        // HL (Half-Day Leave) is student-initiated and counts as 0.5 present
        const presentDays = c.P + c.OD + c.HL * 0.5;
        const attendancePct = totalWorkingDays > 0
          ? Math.round((presentDays / totalWorkingDays) * 10000) / 100
          : 0;
        const row: Record<string, unknown> = {
          studentId: enr.studentId,
          rollNumber: enr.rollNumber ?? '',
          studentName: `${enr.student.firstName} ${enr.student.lastName ?? ''}`.trim(),
          ...c,
          attendancePct,
        };
        if (isSingleDay && dayLog) {
          try {
            const blob = JSON.parse(dayLog.attendanceBlob);
            const entry = blob?.students?.[enr.studentId];
            row.dayStatus = entry?.s ?? '--';
          } catch { /* skip */ }
        }
        return row;
      })
      .sort((a, b) => {
        const ra = a.rollNumber as string;
        const rb = b.rollNumber as string;
        const na = parseInt(ra, 10);
        const nb = parseInt(rb, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return ra.localeCompare(rb);
      });

    return { ...common, rows };
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
        gradePoint: dto.gradePoint ?? 0,
        performanceIndicator: dto.performanceIndicator ?? '',
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
        gradePoint: true, performanceIndicator: true,
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
        ...(dto.name                 !== undefined && { name:                 dto.name }),
        ...(dto.grade                !== undefined && { grade:                dto.grade }),
        ...(dto.minPercentage        !== undefined && { minPercentage:        dto.minPercentage }),
        ...(dto.maxPercentage        !== undefined && { maxPercentage:        dto.maxPercentage }),
        ...(dto.gradePoint           !== undefined && { gradePoint:           dto.gradePoint }),
        ...(dto.performanceIndicator !== undefined && { performanceIndicator: dto.performanceIndicator }),
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

    // 1b. Check attendance lock ï¿½ if locked, absent status cannot be changed
    const lock = await this.prisma.examSectionLock.findUnique({
      where: { tenantId_examId_sectionId: { tenantId: context.tenantId, examId: examSubject.examId, sectionId: dto.sectionId } },
      select: { locked: true },
    });
    if (lock?.locked) {
      const existingMarks = await this.prisma.studentMark.findMany({
        where: {
          tenantId: context.tenantId,
          examId: examSubject.examId,
          subjectId: examSubject.subjectId,
          studentId: { in: dto.records.map((r) => r.studentId) },
          softDelete: false,
        },
        select: { studentId: true, isAbsent: true },
      });
      const existingAbsent = new Map(existingMarks.map((m) => [m.studentId, m.isAbsent]));
      for (const rec of dto.records) {
        const wasAbsent = existingAbsent.get(rec.studentId) ?? false;
        if ((rec.isAbsent ?? false) !== wasAbsent) {
          throw new BadRequestException(
            '[ERR-MARK-4003] Attendance is locked for this section. Cannot change absent status.',
          );
        }
      }
    }

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
          isAbsent: r.isAbsent ?? false,
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
      select: { id: true, studentId: true, marksObtained: true, isAbsent: true, remarks: true },
    });

    return {
      examId: examSubject.examId,
      subjectId: examSubject.subjectId,
      maxMarks: examSubject.maxMarks,
      marks,
    };
  }


  // -- Mark Analytics ----------------------------------------------------------

  /**
   * Computes per-subject analytics for a given exam + section:
   * - Distinct 1st/2nd/3rd highest scores with student counts
   * - Grade distribution using MASTER_TEMPLATE GradeScale
   * - Pass percentage based on minimum pass grade
   * - Averages calculated only on appeared (non-absent) students
   */
  async getMarkAnalytics(
    tenantId: string,
    examId: string,
    sectionId: string,
  ) {
    // 1. Validate the exam belongs to this tenant
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, tenantId, softDelete: false },
      select: { id: true },
    });
    if (!exam) throw new NotFoundException('[ERR-ANLY-4041] Exam not found');

    // 2. Fetch all ExamSubjects for this exam (with subject name)
    const examSubjects = await this.prisma.examSubject.findMany({
      where: { tenantId, examId, softDelete: false },
      select: {
        id: true,
        subjectId: true,
        maxMarks: true,
        subject: { select: { name: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    });

    // 3. Fetch enrolled student IDs for this section
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, sectionId, softDelete: false },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    // 4. Fetch MASTER_TEMPLATE grade scales for grade distribution and pass %
    const gradeScales = await this.prisma.gradeScale.findMany({
      where: { tenantId: 'MASTER_TEMPLATE', softDelete: false },
      select: { grade: true, minPercentage: true, maxPercentage: true, gradePoint: true, performanceIndicator: true },
      orderBy: { minPercentage: 'desc' },
    });

    // Determine the minimum pass grade: the grade with the lowest minPercentage
    // that is NOT the absolute lowest grade (which is the fail grade).
    // Convention: the grade with minPercentage = 0 (or the lowest) is the fail grade.
    const sortedByMin = [...gradeScales].sort((a, b) => a.minPercentage - b.minPercentage);
    const passThreshold = sortedByMin.length >= 2
      ? sortedByMin[1].minPercentage  // Second-lowest grade is the minimum pass grade
      : 33;                           // Fallback: 33% standard pass mark

    if (studentIds.length === 0) {
      const emptyGradeDist = gradeScales.map((g) => ({ grade: g.grade, count: 0 }));
      return {
        subjects: examSubjects.map((es) => ({
          subjectId: es.subjectId,
          subjectName: es.subject.name,
          maxMarks: es.maxMarks,
          totalStudents: 0,
          markedStudents: 0,
          highestMark: null, highestCount: 0,
          secondHighest: null, secondHighestCount: 0,
          thirdHighest: null, thirdHighestCount: 0,
          lowestMark: null,
          averageMark: null,
          passPercentage: null,
          gradeDistribution: emptyGradeDist,
        })),
        gradeScales: gradeScales.map((g) => ({ grade: g.grade, minPercentage: g.minPercentage, maxPercentage: g.maxPercentage })),
        passThreshold,
      };
    }

    // 5. Fetch all marks for this exam across all subjects for the enrolled students
    const allMarks = await this.prisma.studentMark.findMany({
      where: {
        tenantId,
        examId,
        studentId: { in: studentIds },
        softDelete: false,
      },
      select: { subjectId: true, marksObtained: true, isAbsent: true, remarks: true },
    });

    // 6. Group marks by subjectId ï¿½ exclude absent students from statistics
    const marksBySubject = new Map<string, number[]>();
    for (const m of allMarks) {
      if (m.isAbsent || m.remarks?.startsWith('ABSENT')) continue;
      const arr = marksBySubject.get(m.subjectId) ?? [];
      arr.push(m.marksObtained);
      marksBySubject.set(m.subjectId, arr);
    }

    // 7. Compute per-subject analytics with distinct ranks, grade dist, pass %
    const subjects = examSubjects.map((es) => {
      const scores = marksBySubject.get(es.subjectId) ?? [];
      const sorted = [...scores].sort((a, b) => b - a);
      const count = sorted.length;

      // Extract distinct top-3 scores with counts
      const distinctScores: { score: number; count: number }[] = [];
      for (const s of sorted) {
        const existing = distinctScores.find((d) => d.score === s);
        if (existing) { existing.count++; }
        else { distinctScores.push({ score: s, count: 1 }); }
        if (distinctScores.length > 3 && !existing) break;
      }

      // Grade distribution: count students in each grade bucket
      const gradeDistribution = gradeScales.map((g) => {
        const cnt = scores.filter((s) => {
          const pct = (s / es.maxMarks) * 100;
          return pct >= g.minPercentage && pct <= g.maxPercentage;
        }).length;
        return { grade: g.grade, count: cnt };
      });

      // Pass percentage: fraction of appeared students above pass threshold
      const passCount = scores.filter((s) => (s / es.maxMarks) * 100 >= passThreshold).length;

      return {
        subjectId: es.subjectId,
        subjectName: es.subject.name,
        maxMarks: es.maxMarks,
        totalStudents: studentIds.length,
        markedStudents: count,
        highestMark: distinctScores[0]?.score ?? null,
        highestCount: distinctScores[0]?.count ?? 0,
        secondHighest: distinctScores[1]?.score ?? null,
        secondHighestCount: distinctScores[1]?.count ?? 0,
        thirdHighest: distinctScores[2]?.score ?? null,
        thirdHighestCount: distinctScores[2]?.count ?? 0,
        lowestMark: count > 0 ? sorted[count - 1] : null,
        averageMark: count > 0
          ? Math.round((sorted.reduce((s, v) => s + v, 0) / count) * 100) / 100
          : null,
        passPercentage: count > 0
          ? Math.round((passCount / count) * 10000) / 100
          : null,
        gradeDistribution,
      };
    });

    return {
      subjects,
      gradeScales: gradeScales.map((g) => ({ grade: g.grade, minPercentage: g.minPercentage, maxPercentage: g.maxPercentage })),
      passThreshold,
    };
  }

  // -- Exam Section Attendance Locking ----------------------------------------

  async lockAttendance(
    examId: string,
    sectionId: string,
    context: RequestContext,
  ): Promise<{ locked: boolean }> {
    // Validate exam belongs to this tenant
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!exam) throw new NotFoundException('[ERR-LOCK-4041] Exam not found');

    await this.prisma.examSectionLock.upsert({
      where: {
        tenantId_examId_sectionId: {
          tenantId: context.tenantId,
          examId,
          sectionId,
        },
      },
      update: { locked: true, lockedBy: context.userId, lockedAt: new Date() },
      create: {
        tenantId: context.tenantId,
        examId,
        sectionId,
        locked: true,
        lockedBy: context.userId,
        lockedAt: new Date(),
      },
    });

    await this.publishAudit(context, 'LOCK', 'ExamSectionLock', examId, 'Attendance locked', {
      examId, sectionId,
    });

    return { locked: true };
  }

  async getAttendanceLockStatus(
    tenantId: string,
    examId: string,
    sectionId: string,
  ): Promise<{ locked: boolean; lockedBy: string | null; lockedAt: Date | null }> {
    const lock = await this.prisma.examSectionLock.findUnique({
      where: { tenantId_examId_sectionId: { tenantId, examId, sectionId } },
      select: { locked: true, lockedBy: true, lockedAt: true },
    });
    return {
      locked: lock?.locked ?? false,
      lockedBy: lock?.lockedBy ?? null,
      lockedAt: lock?.lockedAt ?? null,
    };
  }

  // -- Marks, Grades & Ranks View ----------------------------------------------

  /**
   * Returns a full marks-ranks matrix for a given exam + section.
   * Computes: marks per subject, section rank, class rank, per-subject rank,
   * and grade assignment using MASTER_TEMPLATE grade scales.
   */
  async getMarksRanks(
    tenantId: string,
    examId: string,
    sectionId: string,
  ) {
    // 1. Validate exam
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, tenantId, softDelete: false },
      select: { id: true, name: true, classId: true },
    });
    if (!exam) throw new NotFoundException('[ERR-RANK-4041] Exam not found');

    // 2. Get all exam subjects for this exam
    const examSubjects = await this.prisma.examSubject.findMany({
      where: { tenantId, examId },
      select: { id: true, subjectId: true, maxMarks: true },
    });
    if (examSubjects.length === 0) return { examName: exam.name, classId: exam.classId, sectionId, totalClassStudents: 0, totalSectionStudents: 0, subjects: [], students: [] };

    const subjectIds = examSubjects.map((es) => es.subjectId);

    // 3. Subject name lookup
    const subjectRows = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds }, tenantId, softDelete: false },
      select: { id: true, name: true, code: true },
    });
    const subjectMap = new Map(subjectRows.map((s) => [s.id, s]));

    // Build ordered subjects metadata
    const subjects = examSubjects.map((es) => {
      const sub = subjectMap.get(es.subjectId);
      return {
        subjectId: es.subjectId,
        examSubjectId: es.id,
        name: sub?.name ?? es.subjectId,
        code: sub?.code ?? '',
        maxMarks: es.maxMarks,
      };
    });

    // 4. Fetch enrolled students for the SELECTED SECTION
    const sectionEnrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, classId: exam.classId, sectionId, softDelete: false },
      select: { studentId: true, rollNumber: true },
    });
    const sectionStudentIds = sectionEnrollments.map((e) => e.studentId);
    if (sectionStudentIds.length === 0) return { examName: exam.name, classId: exam.classId, sectionId, totalClassStudents: 0, totalSectionStudents: 0, subjects, students: [] };

    // 5. Fetch enrolled students for ALL SECTIONS of the class (for class rank)
    const classEnrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, classId: exam.classId, softDelete: false },
      select: { studentId: true, sectionId: true },
    });
    const classStudentIds = classEnrollments.map((e) => e.studentId);

    // 6. Fetch student details for the section
    const studentRows = await this.prisma.student.findMany({
      where: { id: { in: sectionStudentIds }, tenantId, softDelete: false },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    });
    const studentDetailsMap = new Map(studentRows.map((s) => [s.id, s]));

    // 7. Fetch ALL marks for ALL class students for this exam (needed for class rank)
    const allMarks = await this.prisma.studentMark.findMany({
      where: {
        tenantId, examId,
        subjectId: { in: subjectIds },
        studentId: { in: classStudentIds },
        softDelete: false,
      },
      select: { studentId: true, subjectId: true, marksObtained: true, isAbsent: true },
    });

    // 8. Build per-student marks lookup: key `studentId:subjectId`
    const markLookup = new Map<string, { marks: number; isAbsent: boolean }>();
    for (const m of allMarks) {
      markLookup.set(`${m.studentId}:${m.subjectId}`, {
        marks: m.isAbsent ? 0 : m.marksObtained,
        isAbsent: m.isAbsent,
      });
    }

    // 9. Compute total marks per student (class-wide) for class rank
    const classTotals = new Map<string, number>();
    for (const sid of classStudentIds) {
      let total = 0;
      for (const es of examSubjects) {
        const entry = markLookup.get(`${sid}:${es.subjectId}`);
        total += entry ? entry.marks : 0;
      }
      classTotals.set(sid, total);
    }

    // 10. Dense rank for class (handles ties: same total = same rank)
    const classSorted = [...classTotals.entries()].sort((a, b) => b[1] - a[1]);
    const classRankMap = new Map<string, number>();
    let cRank = 1;
    for (let i = 0; i < classSorted.length; i++) {
      if (i > 0 && classSorted[i][1] < classSorted[i - 1][1]) cRank = i + 1;
      classRankMap.set(classSorted[i][0], cRank);
    }

    // 11. Dense rank for section
    const sectionTotals = new Map<string, number>();
    for (const sid of sectionStudentIds) {
      sectionTotals.set(sid, classTotals.get(sid) ?? 0);
    }
    const sectionSorted = [...sectionTotals.entries()].sort((a, b) => b[1] - a[1]);
    const sectionRankMap = new Map<string, number>();
    let sRank = 1;
    for (let i = 0; i < sectionSorted.length; i++) {
      if (i > 0 && sectionSorted[i][1] < sectionSorted[i - 1][1]) sRank = i + 1;
      sectionRankMap.set(sectionSorted[i][0], sRank);
    }

    // 12. Per-subject rank within the section (dense rank)
    const subjectRankMaps = new Map<string, Map<string, number>>();
    for (const es of examSubjects) {
      const scores: [string, number][] = sectionStudentIds.map((sid) => {
        const entry = markLookup.get(`${sid}:${es.subjectId}`);
        return [sid, entry ? entry.marks : 0];
      });
      scores.sort((a, b) => b[1] - a[1]);
      const rankMap = new Map<string, number>();
      let r = 1;
      for (let i = 0; i < scores.length; i++) {
        if (i > 0 && scores[i][1] < scores[i - 1][1]) r = i + 1;
        rankMap.set(scores[i][0], r);
      }
      subjectRankMaps.set(es.subjectId, rankMap);
    }

    // 13. Grade scales for grade assignment
    const gradeScales = await this.prisma.gradeScale.findMany({
      where: { tenantId: 'MASTER_TEMPLATE', softDelete: false },
      orderBy: { minPercentage: 'desc' },
      select: { grade: true, minPercentage: true, maxPercentage: true },
    });

    const assignGrade = (marks: number, maxMarks: number): string => {
      if (maxMarks <= 0) return '-';
      const pct = (marks / maxMarks) * 100;
      for (const gs of gradeScales) {
        if (pct >= gs.minPercentage && pct <= gs.maxPercentage) return gs.grade;
      }
      return '-';
    };

    // 14. Build student rows (section students only)
    const rollMap = new Map(sectionEnrollments.map((e) => [e.studentId, e.rollNumber ?? '']));

    const students = sectionStudentIds.map((sid) => {
      const stu = studentDetailsMap.get(sid);
      const rollNumber = rollMap.get(sid) ?? '';

      const subjectData: Record<string, { marks: number; isAbsent: boolean; grade: string; rank: number }> = {};
      let totalMarks = 0;
      let totalMaxMarks = 0;

      for (const es of examSubjects) {
        const entry = markLookup.get(`${sid}:${es.subjectId}`);
        const marks = entry ? entry.marks : 0;
        const isAbsent = entry?.isAbsent ?? true;
        const grade = isAbsent ? 'AB' : assignGrade(marks, es.maxMarks);
        const rank = subjectRankMaps.get(es.subjectId)?.get(sid) ?? 0;
        subjectData[es.subjectId] = { marks, isAbsent, grade, rank };
        totalMarks += marks;
        totalMaxMarks += es.maxMarks;
      }

      return {
        studentId: sid,
        admissionNumber: stu?.admissionNumber ?? '-',
        firstName: stu?.firstName ?? '-',
        lastName: stu?.lastName ?? '',
        rollNumber,
        subjectData,
        totalMarks,
        totalMaxMarks,
        overallGrade: assignGrade(totalMarks, totalMaxMarks),
        sectionRank: sectionRankMap.get(sid) ?? 0,
        classRank: classRankMap.get(sid) ?? 0,
      };
    });

    // Sort by roll number
    students.sort((a, b) => {
      const na = parseInt(a.rollNumber, 10);
      const nb = parseInt(b.rollNumber, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.rollNumber.localeCompare(b.rollNumber);
    });

    return {
      examName: exam.name,
      classId: exam.classId,
      sectionId,
      totalClassStudents: classStudentIds.length,
      totalSectionStudents: sectionStudentIds.length,
      subjects,
      students,
    };
  }

  // -- Result Aggregation Engine -----------------------------------------------

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
    const sectionOfStudent: Record<string, string | null> = {};
    for (const e of enrollments) sectionOfStudent[e.studentId] = e.sectionId;

    // 3. Total max marks across all ExamSubjects for this exam
    const examSubjectsAgg = await this.prisma.examSubject.findMany({
      where: { tenantId: context.tenantId, examId, softDelete: false },
      select: { maxMarks: true },
    });
    const totalMaxMarks = examSubjectsAgg.reduce((sum, es) => sum + es.maxMarks, 0);
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

    // 5. Grade scale (highest minPercentage first => first match wins)
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
      sectionId: string | null;
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
      const secKey = sa.sectionId ?? '__no_section__';
      if (!bySec[secKey]) bySec[secKey] = [];
      bySec[secKey].push(sa);
    }
    const sectionRankMapAgg: Record<string, number> = {};
    for (const secStudents of Object.values(bySec)) {
      const secSorted = [...secStudents].sort((a, b) => b.totalObtained - a.totalObtained);
      secSorted.forEach((s, i) => { sectionRankMapAgg[s.studentId] = i + 1; });
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
          sectionRank: sectionRankMapAgg[sa.studentId],
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

  // -- Academic Calendar -------------------------------------------------------

  /** Canonical Academic Calendar CSV template (embedded; no filesystem dependency). */
  getCalendarTemplate(): string {
    return [
      'Sl No,Academic Year,Date,Occasion / Milestone,Type,Working Day?',
      '1,2025-2026,01-Apr-25,New Academic Session Begins,Academic,Yes',
      '2,2025-2026,06-Apr-25,Ram Navami,Holiday,No',
      '3,2025-2026,10-Apr-25,Mahavir Jayanti,Holiday,No',
      '4,2025-2026,14-Apr-25,Dr. Ambedkar Jayanti,Holiday,No',
      '5,2025-2026,18-Apr-25,Good Friday,Holiday,No',
      '6,2025-2026,16-May-25,Summer Vacation Starts,Vacation_Start,No',
      '7,2025-2026,07-Jun-25,Id-ul-Zuha (Bakrid),Holiday,No',
      '8,2025-2026,22-Jun-25,Summer Vacation Ends,Vacation_End,No',
      '9,2025-2026,23-Jun-25,School Reopens after Summer Break,Academic,Yes',
      '10,2025-2026,06-Jul-25,Muharram,Holiday,No',
      '11,2025-2026,15-Jul-25,Periodic Test - I (PT-1) Starts,Exam,Yes',
      '12,2025-2026,25-Jul-25,Periodic Test - I (PT-1) Ends,Exam,Yes',
      '13,2025-2026,15-Aug-25,Independence Day (Flag Hoisting),Holiday,No',
      '14,2025-2026,16-Aug-25,Janmashtami,Holiday,No',
      '15,2025-2026,27-Aug-25,Ganesh Chaturthi,Holiday,No',
      "16,2025-2026,05-Sep-25,Id-e-Milad / Teachers' Day,Holiday,No",
      '17,2025-2026,20-Sep-25,Half-Yearly / Term-1 Exams Start,Exam_Start,Yes',
      '18,2025-2026,30-Sep-25,Half-Yearly / Term-1 Exams Ends,Exam_End,Yes',
      '19,2025-2026,02-Oct-25,Gandhi Jayanti / Vijayadashami,Holiday,No',
      '20,2025-2026,15-Oct-25,Term-1 Result Declaration (PTM),Event,Yes',
      '21,2025-2026,18-Oct-25,Diwali / Mid-Term Break Starts,Vacation_Start,No',
      '22,2025-2026,23-Oct-25,Diwali / Mid-Term Break Ends,Vacation_End,No',
      "23,2025-2026,14-Nov-25,Children's Day,Celebration,Yes",
      '24,2025-2026,01-Dec-25,Periodic Test - II (PT-2) Starts,Exam,Yes',
      '25,2025-2026,10-Dec-25,Periodic Test - II (PT-2) Ends,Exam,Yes',
      '26,2025-2026,25-Dec-25,Christmas Day,Holiday,No',
      '27,2025-2026,29-Dec-25,Winter Break Starts,Vacation_Start,No',
      '28,2025-2026,07-Jan-26,Winter Break Ends,Vacation_End,No',
      '29,2025-2026,15-Jan-26,Pre-Board Exams (Class 10 & 12) Starts,Exam,Yes',
      '30,2025-2026,25-Jan-26,Pre-Board Exams (Class 10 & 12) Ends,Exam,Yes',
      '31,2025-2026,26-Jan-26,Republic Day,Holiday,No',
      '32,2025-2026,15-Feb-26,Maha Shivratri,Holiday,No',
      '33,2025-2026,17-Feb-26,CBSE Board Exams Begin,Exam,Yes',
      '34,2025-2026,01-Mar-26,Annual Exams (Non-Board) Starts,Exam_Start,Yes',
      '35,2025-2026,04-Mar-26,Holi,Holiday,No',
      '36,2025-2026,15-Mar-26,Annual Exams (Non-Board) Ends,Exam_End,Yes',
      '37,2025-2026,21-Mar-26,Id-ul-Fitr (Ramzan),Holiday,No',
      '38,2025-2026,25-Mar-26,Final Result Declaration (PTM),Event,Yes',
      '39,2025-2026,31-Mar-26,Academic Session Ends,Academic,Yes',
    ].join('\r\n');
  }

  /**
   * Validates raw CSV text against the academic calendar template format.
   * Returns an array of row/column mismatches. Empty array = valid.
   */
  validateAcademicCalendarCsv(
    csvContent: string,
    academicYearName: string,
    ayStartDate?: Date,
    ayEndDate?: Date,
  ): { errors: import('./dto/upload-academic-calendar.dto').CalendarValidationError[] } {
    const { CALENDAR_ENTRY_TYPES } = require('./dto/upload-academic-calendar.dto');
    type VErr = import('./dto/upload-academic-calendar.dto').CalendarValidationError;
    const errors: VErr[] = [];
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      errors.push({ row: 1, column: 0, columnName: 'Header', value: '', expected: 'CSV must have a header row and at least one data row' });
      return { errors };
    }

    // Validate header row
    const expectedHeader = 'Sl No,Academic Year,Date,Occasion / Milestone,Type,Working Day?';
    const actualHeader = lines[0].trim();
    if (actualHeader !== expectedHeader) {
      errors.push({
        row: 1, column: 0, columnName: 'Header',
        value: actualHeader,
        expected: expectedHeader,
      });
    }

    const YEAR_REGEX = /^\d{4}-\d{4}$/;
    // DD-Mon-YY or DD-Mon-YYYY
    const DATE_REGEX = /^\d{1,2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2,4}$/i;
    const typeSet = new Set(CALENDAR_ENTRY_TYPES as readonly string[]);

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const rowNum = i + 1; // 1-indexed for user display

      // Column count check
      if (cols.length < 6) {
        errors.push({ row: rowNum, column: 0, columnName: 'Row', value: lines[i], expected: '6 columns required' });
        continue;
      }

      // Col 1: Sl No — must be a positive integer, sequential starting from 1
      const slNo = parseInt(cols[0], 10);
      if (isNaN(slNo) || slNo !== i) {
        errors.push({
          row: rowNum, column: 1, columnName: 'Sl No',
          value: cols[0],
          expected: `Sequential number starting from 1 (expected ${i})`,
        });
      }

      // Col 2: Academic Year — must match yyyy-yyyy format
      if (!YEAR_REGEX.test(cols[1])) {
        errors.push({
          row: rowNum, column: 2, columnName: 'Academic Year',
          value: cols[1],
          expected: 'Format yyyy-yyyy (e.g., 2025-2026)',
        });
      } else if (cols[1] !== academicYearName) {
        errors.push({
          row: rowNum, column: 2, columnName: 'Academic Year',
          value: cols[1],
          expected: `Must match selected academic year: ${academicYearName}`,
        });
      }

      // Col 3: Date — must be a valid date in DD-Mon-YY format
      if (!DATE_REGEX.test(cols[2])) {
        errors.push({
          row: rowNum, column: 3, columnName: 'Date',
          value: cols[2],
          expected: 'Date in DD-Mon-YY format (e.g., 01-Apr-25)',
        });
      } else {
        const parsed = new Date(cols[2]);
        if (isNaN(parsed.getTime())) {
          errors.push({
            row: rowNum, column: 3, columnName: 'Date',
            value: cols[2],
            expected: 'Must be a valid date',
          });
        } else if (ayStartDate && ayEndDate) {
          // Cross-validate: date must fall within the academic year's configured range.
          // This catches the common mistake of uploading a prior-year template with dates
          // that don't match the selected academic year.
          const parsedUTC = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
          const ayS = new Date(Date.UTC(ayStartDate.getUTCFullYear(), ayStartDate.getUTCMonth(), ayStartDate.getUTCDate()));
          const ayE = new Date(Date.UTC(ayEndDate.getUTCFullYear(), ayEndDate.getUTCMonth(), ayEndDate.getUTCDate()));
          if (parsedUTC < ayS || parsedUTC > ayE) {
            const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const fmt = (d: Date) =>
              `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
            errors.push({
              row: rowNum, column: 3, columnName: 'Date',
              value: cols[2],
              expected: `Date must fall within ${academicYearName} range: ${fmt(ayS)} to ${fmt(ayE)}`,
            });
          }
        }
      }

      // Col 4: Occasion/Milestone — must be non-empty text
      if (!cols[3] || cols[3].length === 0) {
        errors.push({
          row: rowNum, column: 4, columnName: 'Occasion / Milestone',
          value: cols[3] ?? '',
          expected: 'Non-empty text description',
        });
      }

      // Col 5: Type — must be one of the defined types
      if (!typeSet.has(cols[4])) {
        errors.push({
          row: rowNum, column: 5, columnName: 'Type',
          value: cols[4],
          expected: `One of: ${[...typeSet].join(', ')}`,
        });
      }

      // Col 6: Working Day? — must be Yes or No
      const wd = cols[5];
      if (wd !== 'Yes' && wd !== 'No') {
        errors.push({
          row: rowNum, column: 6, columnName: 'Working Day?',
          value: wd,
          expected: 'Yes or No',
        });
      }
    }

    return { errors };
  }

  /**
   * Persists validated academic calendar CSV entries into the database.
   * Replaces any existing entries for the same tenant + academic year.
   */
  async uploadAcademicCalendar(
    csvContent: string,
    academicYearId: string,
    context: RequestContext,
  ): Promise<{ uploaded: number }> {
    // Verify academic year exists in this tenant
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: context.tenantId, softDelete: false },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!year) throw new NotFoundException('[ERR-CAL-4041] Academic year not found');

    // Validate first — pass AY date range so out-of-range dates are caught
    const { errors } = this.validateAcademicCalendarCsv(csvContent, year.name, year.startDate, year.endDate);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: '[ERR-CAL-4001] CSV validation failed',
        errors,
      });
    }

    // Parse rows
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    const dataRows = lines.slice(1);

    // Atomic: delete existing entries for this year, then insert fresh
    const uploaded = await this.prisma.$transaction(async (tx) => {
      await tx.academicCalendarEntry.deleteMany({
        where: { tenantId: context.tenantId, academicYearId },
      });

      const entries = dataRows.map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        return {
          id: randomUUID(),
          tenantId: context.tenantId,
          academicYearId,
          slNo: parseInt(cols[0], 10),
          date: new Date(cols[2]),
          title: cols[3],
          type: cols[4] as any,
          isWorkingDay: cols[5] === 'Yes',
          createdBy: context.userId,
          updatedBy: context.userId,
        };
      });

      await tx.academicCalendarEntry.createMany({ data: entries });
      return entries.length;
    });

    await this.publishAudit(
      context, 'UPLOAD', 'AcademicCalendarEntry', academicYearId,
      `Academic calendar uploaded (${uploaded} entries)`,
      { academicYearId, count: uploaded },
    );

    return { uploaded };
  }

  /**
   * Lists academic calendar entries for a given tenant and academic year.
   */
  async listAcademicCalendar(
    tenantId: string,
    academicYearId: string,
  ): Promise<object[]> {
    return this.prisma.academicCalendarEntry.findMany({
      where: { tenantId, academicYearId, softDelete: false },
      orderBy: { slNo: 'asc' },
      select: {
        id: true,
        slNo: true,
        date: true,
        title: true,
        type: true,
        isWorkingDay: true,
        createdAt: true,
      },
    });
  }

  // ── Holiday Engine ──────────────────────────────────────────────────────────

  /** Map JS Date.getDay() (0=Sun) to Prisma DayOfWeek enum. */
  private toDayOfWeek(jsDay: number): string {
    const map: Record<number, string> = {
      0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY',
      4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY',
    };
    return map[jsDay];
  }

  /** Calculate occurrence of a weekday within its month (1st, 2nd, …). */
  private occurrenceInMonth(d: Date): number {
    return Math.ceil(d.getUTCDate() / 7);
  }

  // ── Weekend Config CRUD ───────────────────────────────────────────────────

  async saveWeekendConfig(
    dto: SaveWeekendConfigDto,
    context: RequestContext,
  ): Promise<{ saved: number }> {
    const upserts = dto.days.map((day) =>
      this.prisma.weekendConfig.upsert({
        where: {
          tenantId_academicYearId_dayOfWeek: {
            tenantId: context.tenantId,
            academicYearId: dto.academicYearId,
            dayOfWeek: day.dayOfWeek as any,
          },
        },
        update: {
          isFullHoliday: day.isFullHoliday,
          firstHalfOff: day.firstHalfOff,
          secondHalfOff: day.secondHalfOff,
          updatedBy: context.userId,
        },
        create: {
          tenantId: context.tenantId,
          academicYearId: dto.academicYearId,
          dayOfWeek: day.dayOfWeek as any,
          isFullHoliday: day.isFullHoliday,
          firstHalfOff: day.firstHalfOff,
          secondHalfOff: day.secondHalfOff,
          createdBy: context.userId,
        },
      }),
    );
    const results = await this.prisma.$transaction(upserts);
    return { saved: results.length };
  }

  async getWeekendConfig(
    tenantId: string,
    academicYearId: string,
  ): Promise<object[]> {
    return this.prisma.weekendConfig.findMany({
      where: { tenantId, academicYearId },
      orderBy: { dayOfWeek: 'asc' },
      select: {
        id: true,
        dayOfWeek: true,
        isFullHoliday: true,
        firstHalfOff: true,
        secondHalfOff: true,
      },
    });
  }

  // ── Holiday Matrix Rules CRUD ─────────────────────────────────────────────

  async saveMatrixRules(
    dto: SaveMatrixRulesDto,
    context: RequestContext,
  ): Promise<{ saved: number }> {
    const upserts = dto.rules.map((rule) =>
      this.prisma.holidayMatrixRule.upsert({
        where: {
          tenantId_academicYearId_dayOfWeek_occurrence: {
            tenantId: context.tenantId,
            academicYearId: dto.academicYearId,
            dayOfWeek: rule.dayOfWeek as any,
            occurrence: rule.occurrence,
          },
        },
        update: {
          firstHalfOff: rule.firstHalfOff,
          secondHalfOff: rule.secondHalfOff,
          updatedBy: context.userId,
        },
        create: {
          tenantId: context.tenantId,
          academicYearId: dto.academicYearId,
          dayOfWeek: rule.dayOfWeek as any,
          occurrence: rule.occurrence,
          firstHalfOff: rule.firstHalfOff,
          secondHalfOff: rule.secondHalfOff,
          createdBy: context.userId,
        },
      }),
    );
    const results = await this.prisma.$transaction(upserts);
    return { saved: results.length };
  }

  async getMatrixRules(
    tenantId: string,
    academicYearId: string,
  ): Promise<object[]> {
    return this.prisma.holidayMatrixRule.findMany({
      where: { tenantId, academicYearId },
      orderBy: [{ dayOfWeek: 'asc' }, { occurrence: 'asc' }],
      select: {
        id: true,
        dayOfWeek: true,
        occurrence: true,
        firstHalfOff: true,
        secondHalfOff: true,
      },
    });
  }

  // ── Generation Engine ─────────────────────────────────────────────────────

  /**
   * Generate or preview the holiday list for an academic year.
   *
   * Steps:
   * 1. Fetch academic year date range.
   * 2. Expand Calendar entries (Holiday, Vacation ranges).
   * 3. Apply WeekendConfig for recurring weekend holidays.
   * 4. Apply HolidayMatrixRule for Nth-day policies.
   * 5. Merge — calendar entries override weekend/matrix; manual entries are never overwritten.
   * 6. If preview=false, upsert into HolidayEntry (idempotent).
   */
  async generateHolidays(
    tenantId: string,
    academicYearId: string,
    context: RequestContext,
    preview = false,
    inlineWeekendDays?: Array<{ dayOfWeek: string; isFullHoliday: boolean; firstHalfOff: boolean; secondHalfOff: boolean }>,
    inlineMatrixRules?: Array<{ dayOfWeek: string; occurrence: number; firstHalfOff: boolean; secondHalfOff: boolean }>,
  ): Promise<{ holidays: object[]; saved?: number; yearName?: string }> {
    // 1. Fetch academic year
    const ay = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { startDate: true, endDate: true, name: true },
    });
    if (!ay) throw new NotFoundException('Academic year not found');

    // 2. Fetch calendar entries (holidays, vacations)
    const calendarEntries = await this.prisma.academicCalendarEntry.findMany({
      where: { tenantId, academicYearId, softDelete: false },
      orderBy: { date: 'asc' },
    });

    // ── Gap 1: Order of Operations — Calendar must exist before generating holidays
    if (calendarEntries.length === 0) {
      throw new BadRequestException(
        'Action Denied: Please generate the Academic Calendar for this Academic Year before generating holidays.',
      );
    }

    // 3. Weekend config & matrix rules — use inline (preview) or DB
    const weekendConfigs = inlineWeekendDays
      ? inlineWeekendDays.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isFullHoliday: d.isFullHoliday,
          firstHalfOff: d.firstHalfOff,
          secondHalfOff: d.secondHalfOff,
        }))
      : await this.prisma.weekendConfig.findMany({
          where: { tenantId, academicYearId },
        });
    const matrixRules = inlineMatrixRules
      ? inlineMatrixRules.map((r) => ({
          dayOfWeek: r.dayOfWeek,
          occurrence: r.occurrence,
          firstHalfOff: r.firstHalfOff,
          secondHalfOff: r.secondHalfOff,
        }))
      : await this.prisma.holidayMatrixRule.findMany({
          where: { tenantId, academicYearId },
        });

    // 4. Fetch existing manual entries (isManual: true) so we don't overwrite them
    const existingManual = await this.prisma.holidayEntry.findMany({
      where: { tenantId, academicYearId, isManual: true, softDelete: false },
    });
    const manualDateSet = new Set(
      existingManual.map((e) => e.date.toISOString().split('T')[0]),
    );

    // Build lookup maps
    const weekendMap = new Map(weekendConfigs.map((w) => [w.dayOfWeek, w]));
    const matrixMap = new Map<string, typeof matrixRules[0]>();
    for (const r of matrixRules) {
      matrixMap.set(`${r.dayOfWeek}_${r.occurrence}`, r);
    }

    // Expand vacation ranges from calendar
    const calendarHolidayMap = new Map<string, { occasion: string; type: string }>();
    let vacStart: Date | null = null;
    let vacTitle = '';
    for (const entry of calendarEntries) {
      const dateStr = entry.date.toISOString().split('T')[0];
      if (entry.type === 'Vacation_Start') {
        vacStart = entry.date;
        vacTitle = entry.title;
      } else if (entry.type === 'Vacation_End' && vacStart) {
        // Expand the entire range
        const cursor = new Date(vacStart);
        const endDate = new Date(entry.date);
        while (cursor <= endDate) {
          const ds = cursor.toISOString().split('T')[0];
          calendarHolidayMap.set(ds, { occasion: vacTitle, type: 'Vacation' });
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        vacStart = null;
        vacTitle = '';
      } else if (entry.type === 'Holiday') {
        calendarHolidayMap.set(dateStr, { occasion: entry.title, type: 'Holiday' });
      }
    }

    // 5. Walk every date in the academic year
    const holidays: Array<{
      date: string;
      occasion: string;
      type: string;
      isFullDay: boolean;
      isFirstHalf: boolean;
      isSecondHalf: boolean;
      source: string;
      remarks?: string;
    }> = [];

    const cursor = new Date(ay.startDate);
    const endDate = new Date(ay.endDate);
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      const jsDay = cursor.getUTCDay();
      const dow = this.toDayOfWeek(jsDay);
      const occ = this.occurrenceInMonth(cursor);

      // Skip dates that are manually managed
      if (manualDateSet.has(dateStr)) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Priority 1: Calendar-sourced holidays (Holiday / Vacation range)
      const calEntry = calendarHolidayMap.get(dateStr);
      if (calEntry) {
        holidays.push({
          date: dateStr,
          occasion: calEntry.occasion,
          type: calEntry.type,
          isFullDay: true,
          isFirstHalf: false,
          isSecondHalf: false,
          source: 'CALENDAR',
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Priority 2: Weekend config (full day weekend holidays)
      const wkCfg = weekendMap.get(dow as any);
      if (wkCfg?.isFullHoliday) {
        holidays.push({
          date: dateStr,
          occasion: `${dow.charAt(0) + dow.slice(1).toLowerCase()} Weekend`,
          type: 'Weekend',
          isFullDay: true,
          isFirstHalf: false,
          isSecondHalf: false,
          source: 'WEEKEND',
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Priority 3: Matrix rule for Nth occurrence overrides weekend half-day
      const matrixKey = `${dow}_${occ}`;
      const matRule = matrixMap.get(matrixKey);
      if (matRule && (matRule.firstHalfOff || matRule.secondHalfOff)) {
        const isFullDay = matRule.firstHalfOff && matRule.secondHalfOff;
        holidays.push({
          date: dateStr,
          occasion: `${occ}${this.ordinalSuffix(occ)} ${dow.charAt(0) + dow.slice(1).toLowerCase()}`,
          type: isFullDay ? 'Holiday' : 'Half-Day',
          isFullDay,
          isFirstHalf: matRule.firstHalfOff && !matRule.secondHalfOff,
          isSecondHalf: matRule.secondHalfOff && !matRule.firstHalfOff,
          source: 'MATRIX',
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Priority 4: Weekend half-day config (not full holiday but has half-day)
      if (wkCfg && (wkCfg.firstHalfOff || wkCfg.secondHalfOff)) {
        const isFullDay = wkCfg.firstHalfOff && wkCfg.secondHalfOff;
        holidays.push({
          date: dateStr,
          occasion: `${dow.charAt(0) + dow.slice(1).toLowerCase()} Half-Day`,
          type: isFullDay ? 'Weekend' : 'Half-Day',
          isFullDay,
          isFirstHalf: wkCfg.firstHalfOff && !wkCfg.secondHalfOff,
          isSecondHalf: wkCfg.secondHalfOff && !wkCfg.firstHalfOff,
          source: 'WEEKEND',
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // 6. Add calendar holidays whose dates fell outside the AY date range
    // (e.g. template calendar entries with dates from a different year).
    // The date-walking loop only covers ay.startDate → ay.endDate, so
    // calendar entries outside that window must be added explicitly.
    const walkedDateSet = new Set(holidays.map((h) => h.date));
    for (const [dateStr, cal] of calendarHolidayMap) {
      if (!manualDateSet.has(dateStr) && !walkedDateSet.has(dateStr)) {
        holidays.push({
          date: dateStr,
          occasion: cal.occasion,
          type: cal.type,
          isFullDay: true,
          isFirstHalf: false,
          isSecondHalf: false,
          source: 'CALENDAR',
        });
      }
    }

    // 7. Add existing manual entries into the list for completeness
    for (const m of existingManual) {
      holidays.push({
        date: m.date.toISOString().split('T')[0],
        occasion: m.occasion,
        type: m.type,
        isFullDay: m.isFullDay,
        isFirstHalf: m.isFirstHalf,
        isSecondHalf: m.isSecondHalf,
        source: 'MANUAL',
        remarks: m.remarks ?? '',
      });
    }

    // Sort by date
    holidays.sort((a, b) => a.date.localeCompare(b.date));

    if (preview) {
      return { holidays, yearName: ay.name };
    }

    // 8. Upsert into DB — idempotent, skip manual entries
    // ── Gap 2: Source Protection — fetch existing protected entries so the
    //    engine never overwrites CALENDAR or MANUAL records.
    //    Cloned master entries retain their original source (e.g. CALENDAR),
    //    so they are naturally protected without relying on free-text fields.
    const existingProtected = await this.prisma.holidayEntry.findMany({
      where: {
        tenantId,
        academicYearId,
        softDelete: false,
        OR: [
          { isManual: true },
          { source: 'CALENDAR' },
        ],
      },
      select: { date: true },
    });
    const protectedDateSet = new Set(
      existingProtected.map((e) => e.date.toISOString().split('T')[0]),
    );

    const upserts = holidays
      .filter((h) => {
        // manual already exist in DB
        if (h.source === 'MANUAL') return false;
        // Source Protection: if this date has a protected entry and the new
        // source is engine-generated (WEEKEND or MATRIX), skip the upsert
        // to preserve the higher-priority record.
        if (
          (h.source === 'WEEKEND' || h.source === 'MATRIX') &&
          protectedDateSet.has(h.date)
        ) {
          return false;
        }
        return true;
      })
      .map((h) =>
        this.prisma.holidayEntry.upsert({
          where: {
            tenantId_academicYearId_date: {
              tenantId,
              academicYearId,
              date: new Date(h.date),
            },
          },
          update: {
            occasion: h.occasion,
            type: h.type,
            isFullDay: h.isFullDay,
            isFirstHalf: h.isFirstHalf,
            isSecondHalf: h.isSecondHalf,
            source: h.source as any,
            isManual: false,
            updatedBy: context.userId,
          },
          create: {
            tenantId,
            academicYearId,
            date: new Date(h.date),
            occasion: h.occasion,
            type: h.type,
            isFullDay: h.isFullDay,
            isFirstHalf: h.isFirstHalf,
            isSecondHalf: h.isSecondHalf,
            source: h.source as any,
            isManual: false,
            createdBy: context.userId,
          },
        }),
      );

    // Batch in chunks of 50 to avoid exceeding transaction limits
    let saved = 0;
    const BATCH = 50;
    for (let i = 0; i < upserts.length; i += BATCH) {
      const batch = upserts.slice(i, i + BATCH);
      await this.prisma.$transaction(batch);
      saved += batch.length;
    }

    return { holidays, saved };
  }

  private ordinalSuffix(n: number): string {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
  }

  // ── Holiday Status Lookup (Attendance Integration) ─────────────────────────

  /**
   * Returns the holiday status for a specific date within an academic year.
   * Used by the Attendance module to show banners and disable controls.
   */
  async getHolidayStatus(
    tenantId: string,
    academicYearId: string,
    date: string,
  ): Promise<{
    isHoliday: boolean;
    isFullDay: boolean;
    isFirstHalf: boolean;
    isSecondHalf: boolean;
    occasion: string;
    type: string;
    source: string;
  } | null> {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    const entry = await this.prisma.holidayEntry.findFirst({
      where: { tenantId, academicYearId, date: d, softDelete: false },
      select: {
        occasion: true,
        type: true,
        isFullDay: true,
        isFirstHalf: true,
        isSecondHalf: true,
        source: true,
      },
    });

    if (!entry) return null;

    return {
      isHoliday: true,
      isFullDay: entry.isFullDay,
      isFirstHalf: entry.isFirstHalf,
      isSecondHalf: entry.isSecondHalf,
      occasion: entry.occasion,
      type: entry.type,
      source: entry.source,
    };
  }

  /**
   * Batch-fetch all holiday dates for a date range (used by getAttendanceReport).
   * Returns a Map of ISO date → HolidayEntry for quick lookup.
   */
  private async getHolidayMap(
    tenantId: string,
    academicYearId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, { isFullDay: boolean; isFirstHalf: boolean; isSecondHalf: boolean }>> {
    const entries = await this.prisma.holidayEntry.findMany({
      where: {
        tenantId,
        academicYearId,
        date: { gte: startDate, lte: endDate },
        softDelete: false,
      },
      select: { date: true, isFullDay: true, isFirstHalf: true, isSecondHalf: true },
    });

    const map = new Map<string, { isFullDay: boolean; isFirstHalf: boolean; isSecondHalf: boolean }>();
    for (const e of entries) {
      const key = new Date(e.date).toISOString().slice(0, 10);
      map.set(key, { isFullDay: e.isFullDay, isFirstHalf: e.isFirstHalf, isSecondHalf: e.isSecondHalf });
    }
    return map;
  }

  // ── Holiday Entry CRUD ────────────────────────────────────────────────────

  async listHolidays(
    tenantId: string,
    academicYearId: string,
  ): Promise<object[]> {
    return this.prisma.holidayEntry.findMany({
      where: { tenantId, academicYearId, softDelete: false },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        occasion: true,
        type: true,
        isFullDay: true,
        isFirstHalf: true,
        isSecondHalf: true,
        source: true,
        isManual: true,
        remarks: true,
        createdAt: true,
      },
    });
  }

  async createHolidayEntry(
    dto: CreateHolidayEntryDto,
    context: RequestContext,
  ): Promise<{ id: string }> {
    const entry = await this.prisma.holidayEntry.create({
      data: {
        tenantId: context.tenantId,
        academicYearId: dto.academicYearId,
        date: new Date(dto.date),
        occasion: dto.occasion,
        type: dto.type,
        isFullDay: dto.isFullDay,
        isFirstHalf: dto.isFirstHalf,
        isSecondHalf: dto.isSecondHalf,
        source: 'MANUAL',
        isManual: true,
        remarks: dto.remarks,
        createdBy: context.userId,
      },
    });
    return { id: entry.id };
  }

  async updateHolidayEntry(
    id: string,
    dto: UpdateHolidayEntryDto,
    context: RequestContext,
  ): Promise<{ updated: boolean }> {
    const existing = await this.prisma.holidayEntry.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Holiday entry not found');

    await this.prisma.holidayEntry.update({
      where: { id },
      data: {
        ...(dto.occasion !== undefined && { occasion: dto.occasion }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.isFullDay !== undefined && { isFullDay: dto.isFullDay }),
        ...(dto.isFirstHalf !== undefined && { isFirstHalf: dto.isFirstHalf }),
        ...(dto.isSecondHalf !== undefined && { isSecondHalf: dto.isSecondHalf }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        isManual: true, // once manually edited, mark as manual
        updatedBy: context.userId,
      },
    });
    return { updated: true };
  }

  async deleteHolidayEntry(
    id: string,
    context: RequestContext,
  ): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.holidayEntry.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Holiday entry not found');

    await this.prisma.holidayEntry.update({
      where: { id },
      data: { softDelete: true, updatedBy: context.userId },
    });
    return { deleted: true };
  }

  // -- Onboarding Seeder -------------------------------------------------------

  /**
   * Idempotent Quick Setup Seeder.
   * Copies academic years, classes, sections, and subjects from MASTER_TEMPLATE
   * into the school's tenant partition.
   */
  async seedDefaultSetup(
    tenantId: string,
    userId: string,
  ): Promise<{ seeded: number }> {
    const context: RequestContext = {
      tenantId,
      userId,
      role: 'SCHOOL_ADMIN',
      correlationId: randomUUID(),
    };

    const { seeded: years }    = await this.seedAcademicYearsFromMaster(context);
    const { seeded: classes }  = await this.seedClassesFromMaster(context);
    const { seeded: sections } = await this.seedSectionsFromMaster(context);
    const { seeded: subjects } = await this.seedSubjectsFromMaster(context);

    const seeded = years + classes + sections + subjects;
    await this.publishAudit(
      context,
      'SEED',
      'School',
      tenantId,
      'Quick Setup: school data generated from master template',
      { seeded, years, classes, sections, subjects },
    );
    return { seeded };
  }

  // -- Report Card View --------------------------------------------------------

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

    // Parallel fetch: per-subject marks + exam-subject max marks + enrollment
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
        className:   enrollmentRaw?.class?.name   ?? '-',
        classCode:   enrollmentRaw?.class?.code   ?? '',
        sectionName: enrollmentRaw?.section?.name ?? '-',
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

  // -- ExamSchedule (Master Data) ----------------------------------------------

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
   * tenant, linked to the specified academicYearId. Idempotent (skips duplicates).
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

    await this.assertEntityExists('AcademicYear', academicYearId, context.tenantId);

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

  // ── Clone Academic Calendar from MASTER_TEMPLATE ────────────────────────────

  /**
   * Copies AcademicCalendarEntry rows from MASTER_TEMPLATE into the tenant's
   * partition for the matching academic year.
   * Uses date + tenantId + academicYearId to prevent duplicates (upsert).
   */
  async cloneAcademicCalendarFromMaster(
    academicYearId: string,
    context: RequestContext,
  ): Promise<{ cloned: number }> {
    // 1. Resolve the tenant's academic year to find a matching MASTER_TEMPLATE year by name
    const tenantAY = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: context.tenantId, softDelete: false },
    });
    if (!tenantAY) throw new NotFoundException('Academic year not found for this tenant');

    // ── Gap 1: Order of Operations — Academic Years must exist before generating calendar
    const yearCount = await this.prisma.academicYear.count({
      where: { tenantId: context.tenantId, softDelete: false },
    });
    if (yearCount === 0) {
      throw new BadRequestException(
        'Action Denied: Please generate Academic Years before generating Academic Calendar.',
      );
    }

    const masterAY = await this.prisma.academicYear.findFirst({
      where: { tenantId: 'MASTER_TEMPLATE', name: tenantAY.name, softDelete: false },
    });
    if (!masterAY) throw new NotFoundException(`No MASTER_TEMPLATE academic year found matching "${tenantAY.name}"`);

    // 2. Fetch all calendar entries from master
    const masterEntries = await this.prisma.academicCalendarEntry.findMany({
      where: { tenantId: 'MASTER_TEMPLATE', academicYearId: masterAY.id, softDelete: false },
      orderBy: { slNo: 'asc' },
    });

    if (masterEntries.length === 0) return { cloned: 0 };

    // 3. Bulk upsert into tenant's partition
    let cloned = 0;
    for (const entry of masterEntries) {
      await this.prisma.academicCalendarEntry.upsert({
        where: {
          tenantId_academicYearId_slNo: {
            tenantId: context.tenantId,
            academicYearId,
            slNo: entry.slNo,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: context.tenantId,
          academicYearId,
          slNo: entry.slNo,
          date: entry.date,
          title: entry.title,
          type: entry.type,
          isWorkingDay: entry.isWorkingDay,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        update: {
          date: entry.date,
          title: entry.title,
          type: entry.type,
          isWorkingDay: entry.isWorkingDay,
          updatedBy: context.userId,
          softDelete: false,
        },
      });
      cloned++;
    }

    await this.publishAudit(
      context, 'CREATE', 'AcademicCalendarEntry', context.tenantId,
      `Cloned ${cloned} academic calendar entries from MASTER_TEMPLATE`,
      { cloned, academicYearId, masterAcademicYearId: masterAY.id },
    );

    return { cloned };
  }

  // ── Clone Holidays (WeekendConfig + MatrixRules + HolidayEntries) from MASTER_TEMPLATE ──

  /**
   * Copies WeekendConfig, HolidayMatrixRule, and HolidayEntry rows from
   * MASTER_TEMPLATE into the tenant's partition.
   * Safety: Never overwrites entries where isManual = true.
   */
  async cloneHolidaysFromMaster(
    academicYearId: string,
    context: RequestContext,
  ): Promise<{ weekendConfigs: number; matrixRules: number; holidayEntries: number }> {
    // 1. Resolve the tenant's academic year to find a matching MASTER_TEMPLATE year by name
    const tenantAY = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: context.tenantId, softDelete: false },
    });
    if (!tenantAY) throw new NotFoundException('Academic year not found for this tenant');

    // ── Gap 1: Order of Operations — Calendar must exist before cloning holidays
    const calendarCount = await this.prisma.academicCalendarEntry.count({
      where: { tenantId: context.tenantId, academicYearId, softDelete: false },
    });
    if (calendarCount === 0) {
      throw new BadRequestException(
        'Action Denied: Please generate the Academic Calendar for this Academic Year before generating holidays.',
      );
    }

    const masterAY = await this.prisma.academicYear.findFirst({
      where: { tenantId: 'MASTER_TEMPLATE', name: tenantAY.name, softDelete: false },
    });
    if (!masterAY) throw new NotFoundException(`No MASTER_TEMPLATE academic year found matching "${tenantAY.name}"`);

    // 2. Clone WeekendConfig
    const masterWeekend = await this.prisma.weekendConfig.findMany({
      where: { tenantId: 'MASTER_TEMPLATE', academicYearId: masterAY.id },
    });

    let weekendConfigs = 0;
    for (const wk of masterWeekend) {
      await this.prisma.weekendConfig.upsert({
        where: {
          tenantId_academicYearId_dayOfWeek: {
            tenantId: context.tenantId,
            academicYearId,
            dayOfWeek: wk.dayOfWeek,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: context.tenantId,
          academicYearId,
          dayOfWeek: wk.dayOfWeek,
          isFullHoliday: wk.isFullHoliday,
          firstHalfOff: wk.firstHalfOff,
          secondHalfOff: wk.secondHalfOff,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        update: {
          isFullHoliday: wk.isFullHoliday,
          firstHalfOff: wk.firstHalfOff,
          secondHalfOff: wk.secondHalfOff,
          updatedBy: context.userId,
        },
      });
      weekendConfigs++;
    }

    // 3. Clone HolidayMatrixRule
    const masterMatrix = await this.prisma.holidayMatrixRule.findMany({
      where: { tenantId: 'MASTER_TEMPLATE', academicYearId: masterAY.id },
    });

    let matrixRules = 0;
    for (const mr of masterMatrix) {
      await this.prisma.holidayMatrixRule.upsert({
        where: {
          tenantId_academicYearId_dayOfWeek_occurrence: {
            tenantId: context.tenantId,
            academicYearId,
            dayOfWeek: mr.dayOfWeek,
            occurrence: mr.occurrence,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: context.tenantId,
          academicYearId,
          dayOfWeek: mr.dayOfWeek,
          occurrence: mr.occurrence,
          firstHalfOff: mr.firstHalfOff,
          secondHalfOff: mr.secondHalfOff,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        update: {
          firstHalfOff: mr.firstHalfOff,
          secondHalfOff: mr.secondHalfOff,
          updatedBy: context.userId,
        },
      });
      matrixRules++;
    }

    // 4. Clone HolidayEntry — SKIP any existing manual overrides
    const masterHolidays = await this.prisma.holidayEntry.findMany({
      where: { tenantId: 'MASTER_TEMPLATE', academicYearId: masterAY.id, softDelete: false },
    });

    // Get existing manual entries for this tenant to protect them
    const existingManual = await this.prisma.holidayEntry.findMany({
      where: { tenantId: context.tenantId, academicYearId, isManual: true, softDelete: false },
      select: { date: true },
    });
    const manualDates = new Set(
      existingManual.map((m) => m.date.toISOString().split('T')[0]),
    );

    let holidayEntries = 0;
    for (const he of masterHolidays) {
      const dateKey = he.date.toISOString().split('T')[0];
      // Safety: never overwrite local manual overrides
      if (manualDates.has(dateKey)) continue;

      await this.prisma.holidayEntry.upsert({
        where: {
          tenantId_academicYearId_date: {
            tenantId: context.tenantId,
            academicYearId,
            date: he.date,
          },
        },
        create: {
          id: randomUUID(),
          tenantId: context.tenantId,
          academicYearId,
          date: he.date,
          occasion: he.occasion,
          type: he.type,
          isFullDay: he.isFullDay,
          isFirstHalf: he.isFirstHalf,
          isSecondHalf: he.isSecondHalf,
          source: he.source,
          isManual: false,
          remarks: `Cloned from Master Template`,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        update: {
          occasion: he.occasion,
          type: he.type,
          isFullDay: he.isFullDay,
          isFirstHalf: he.isFirstHalf,
          isSecondHalf: he.isSecondHalf,
          source: he.source,
          remarks: `Cloned from Master Template`,
          updatedBy: context.userId,
          softDelete: false,
        },
      });
      holidayEntries++;
    }

    await this.publishAudit(
      context, 'CREATE', 'HolidayClone', context.tenantId,
      `Cloned holidays from MASTER_TEMPLATE: ${weekendConfigs} weekend configs, ${matrixRules} matrix rules, ${holidayEntries} holiday entries`,
      { weekendConfigs, matrixRules, holidayEntries, academicYearId },
    );

    return { weekendConfigs, matrixRules, holidayEntries };
  }
}
