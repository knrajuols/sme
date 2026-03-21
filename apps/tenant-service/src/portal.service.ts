import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';

// ── Return-type shapes ────────────────────────────────────────────────────────

export interface TeacherSummary {
  teacher: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    designation: string;
    employeeCode: string;
  };
  assignments: Array<{
    id: string;
    class: { id: string; name: string; code: string };
    section: { id: string; name: string };
  }>;
  subjects: Array<{
    id: string;
    subject: { id: string; name: string; code: string; type: string };
  }>;
}

export interface FamilySummary {
  parent: {
    id: string;
    firstName: string;
    lastName: string | null;
    relation: string | null;
  };
  children: Array<{
    studentId: string;
    firstName: string;
    lastName: string | null;
    admissionNumber: string;
    enrollment: {
      id: string;
      rollNumber: string | null;
      class: { id: string; name: string };
      section: { id: string; name: string } | null;
      academicYear: { id: string; name: string; isActive: boolean };
    } | null;
    feeInvoices: Array<{
      id: string;
      status: string;
      amountDue: number | string;
      amountPaid: number | string;
      dueDate: Date;
      feeStructure: { feeCategory: { name: string } };
    }>;
  }>;
  upcomingExams: Array<{
    id: string;
    name: string;
    classId: string;
    startDate: Date;
    endDate: Date;
    status: string;
  }>;
}

// ── Timetable return-type shapes ─────────────────────────────────────────────

export interface TimetableEntry {
  id:        string;
  dayOfWeek: string;
  period: {
    id:        string;
    name:      string;
    startTime: string;
    endTime:   string;
  };
  subject: { id: string; name: string; code: string };
  class:   { id: string; name: string; code: string };
  section: { id: string; name: string };
  teacher: { id: string; firstName: string | null; lastName: string | null; employeeCode: string };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Teacher Dashboard Summary
   *
   * Derives the Teacher profile strictly from context.userId — no teacherId
   * parameter is accepted.  Throws NotFoundException when the logged-in IAM
   * user has not yet been linked to a Teacher record by the school admin.
   */
  async getTeacherSummary(userId: string, tenantId: string): Promise<TeacherSummary> {
    // Zero-trust: derive teacher from JWT sub, NOT from a request parameter.
    const teacher = await this.prisma.teacher.findFirst({
      where: { tenantId, userId, softDelete: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        designation: true,
        employeeCode: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException(
        'Your teacher profile is pending setup by the administrator.',
      );
    }

    // Fetch class-teacher assignments with nested class + section details.
    const assignments = await this.prisma.classTeacherAssignment.findMany({
      where: { tenantId, teacherId: teacher.id, softDelete: false },
      select: {
        id: true,
        class:   { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
      },
    });

    // Fetch teacher-subject mappings with nested subject details.
    const teacherSubjects = await this.prisma.teacherSubject.findMany({
      where: { tenantId, teacherId: teacher.id },
      select: {
        id: true,
        subject: { select: { id: true, name: true, code: true, type: true } },
      },
    });

    return {
      teacher,
      assignments,
      subjects: teacherSubjects,
    };
  }

  /**
   * Family Dashboard Summary
   *
   * Derives the Parent profile strictly from context.userId — no parentId
   * parameter is accepted.  Throws NotFoundException when the logged-in IAM
   * user has not yet been linked to a Parent record by the school admin.
   */
  async getFamilySummary(userId: string, tenantId: string): Promise<FamilySummary> {
    // Zero-trust: derive parent from JWT sub, NOT from a request parameter.
    const parent = await this.prisma.parent.findFirst({
      where: { tenantId, userId, softDelete: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        relation: true,
      },
    });

    if (!parent) {
      throw new NotFoundException(
        'Your parent profile is pending setup by the administrator.',
      );
    }

    // Fetch children through ParentStudentMapping including active enrollment.
    const mappings = await this.prisma.parentStudentMapping.findMany({
      where: { tenantId, parentId: parent.id, softDelete: false },
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            enrollments: {
              where:   { tenantId, softDelete: false },
              select:  {
                id: true,
                rollNumber: true,
                class:        { select: { id: true, name: true } },
                section:      { select: { id: true, name: true } },
                academicYear: { select: { id: true, name: true, isActive: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            feeInvoices: {
              where:   { tenantId, softDelete: false },
              select:  {
                id:          true,
                status:      true,
                amountDue:   true,
                amountPaid:  true,
                dueDate:     true,
                feeStructure: {
                  select: {
                    feeCategory: { select: { name: true } },
                  },
                },
              },
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    });

    // Build the list of classIds from the children's active enrollments for
    // the upcoming examination query.
    const classIds = [
      ...new Set(
        mappings.flatMap((m) => m.student.enrollments.map((e) => e.class.id)),
      ),
    ];

    // Upcoming exams: endDate >= today, scoped to the children's classes.
    const upcomingExams =
      classIds.length > 0
        ? await this.prisma.exam.findMany({
            where: {
              tenantId,
              classId:   { in: classIds },
              softDelete: false,
              endDate:   { gte: new Date() },
            },
            select: {
              id:        true,
              name:      true,
              classId:   true,
              startDate: true,
              endDate:   true,
              status:    true,
            },
            orderBy: { startDate: 'asc' },
            take: 10,
          })
        : [];

    return {
      parent: {
        id: parent.id,
        firstName: parent.firstName,
        lastName:  parent.lastName,
        relation:  parent.relation,
      },
      children: mappings.map((m) => {
        const enr = m.student.enrollments[0];
        return {
          studentId:       m.student.id,
          firstName:       m.student.firstName,
          lastName:        m.student.lastName,
          admissionNumber: m.student.admissionNumber,
          enrollment:      enr ? { id: enr.id, rollNumber: enr.rollNumber, class: enr.class, section: enr.section, academicYear: enr.academicYear } : null,
          feeInvoices:     m.student.feeInvoices.map((inv) => ({ ...inv, amountDue: Number(inv.amountDue), amountPaid: Number(inv.amountPaid) })),
        };
      }),
      upcomingExams,
    };
  }

  /**
   * Teacher Timetable
   *
   * Returns all ClassTimetable entries where the logged-in teacher is
   * assigned.  Lookup is derived exclusively from context.userId — zero trust.
   */
  async getTeacherTimetable(
    userId: string,
    tenantId: string,
  ): Promise<TimetableEntry[]> {
    // Derive teacher record from JWT sub — never from a parameter.
    const teacher = await this.prisma.teacher.findFirst({
      where: { tenantId, userId, softDelete: false },
      select: { id: true },
    });
    if (!teacher) {
      throw new NotFoundException(
        'Your teacher profile is pending setup by the administrator.',
      );
    }

    const entries = await this.prisma.classTimetable.findMany({
      where: { tenantId, teacherId: teacher.id, softDelete: false },
      select: {
        id:        true,
        dayOfWeek: true,
        period:  { select: { id: true, name: true, startTime: true, endTime: true } },
        subject: { select: { id: true, name: true, code: true } },
        class:   { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: [
        { dayOfWeek:        'asc' },
        { period: { startTime: 'asc' } },
      ],
    });

    return entries;
  }

  /**
   * Family Timetable — Strict Visibility
   *
   * Returns ClassTimetable entries ONLY for the classId+sectionId pairs
   * belonging to the parent's own children (active enrollments).
   * A parent can NEVER query the global timetable.
   */
  async getFamilyTimetable(
    userId: string,
    tenantId: string,
  ): Promise<TimetableEntry[]> {
    // Derive parent from JWT sub.
    const parent = await this.prisma.parent.findFirst({
      where: { tenantId, userId, softDelete: false },
      select: { id: true },
    });
    if (!parent) {
      throw new NotFoundException(
        'Your parent profile is pending setup by the administrator.',
      );
    }

    // Fetch active enrollments for all linked children.
    const mappings = await this.prisma.parentStudentMapping.findMany({
      where: { tenantId, parentId: parent.id, softDelete: false },
      select: {
        student: {
          select: {
            enrollments: {
              where:   { tenantId, softDelete: false },
              select:  { classId: true, sectionId: true, academicYear: { select: { id: true, isActive: true } } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Build the STRICT filter: only the specific (classId, sectionId) pairs
    // that belong to this parent's children's active enrollments.
    type ClassSectionPair = { classId: string; sectionId: string | null; academicYearId: string };
    const pairs: ClassSectionPair[] = mappings
      .flatMap((m) => m.student.enrollments)
      .filter((e) => e.academicYear.isActive)
      .map((e) => ({
        classId:       e.classId,
        sectionId:     e.sectionId,
        academicYearId: e.academicYear.id,
      }));

    if (!pairs || pairs.length === 0) return [];

    // Strict Visibility Rule: fetch ONLY the matching class-section pairs.
    // Using OR of exact pairs prevents any cross-class data leakage.
    // Prisma StringFilter does not accept null — omit sectionId from the
    // where clause when the enrollment has no section assigned.
    const entries = await this.prisma.classTimetable.findMany({
      where: {
        tenantId,
        softDelete: false,
        OR: pairs.map((p) => ({
          classId:       p.classId,
          sectionId:     p.sectionId ?? undefined,
          academicYearId: p.academicYearId,
        })),
      },
      select: {
        id:        true,
        dayOfWeek: true,
        period:  { select: { id: true, name: true, startTime: true, endTime: true } },
        subject: { select: { id: true, name: true, code: true } },
        class:   { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: [
        { dayOfWeek:        'asc' },
        { period: { startTime: 'asc' } },
      ],
    });

    return entries as unknown as TimetableEntry[];
  }
}
