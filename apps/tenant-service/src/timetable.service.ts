import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DayOfWeek } from './generated/prisma-client';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { PrismaService } from './prisma/prisma.service';

interface RequestContext {
  tenantId: string;
  userId: string;
}

// All days in display order — returned as part of matrix metadata
const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async createEntry(
    dto: CreateTimetableDto,
    context: RequestContext,
  ): Promise<{ id: string }> {
    try {
      const entry = await this.prisma.classTimetable.create({
        data: {
          tenantId:      context.tenantId,
          academicYearId: dto.academicYearId,
          classId:       dto.classId,
          sectionId:     dto.sectionId,
          periodId:      dto.periodId,
          dayOfWeek:     dto.dayOfWeek,
          subjectId:     dto.subjectId,
          teacherId:     dto.teacherId,
          createdBy:     context.userId,
          updatedBy:     context.userId,
        },
        select: { id: true },
      });
      return { id: entry.id };
    } catch (e: unknown) {
      this.handlePrismaConflict(e);
      throw e;
    }
  }

  async updateEntry(
    id: string,
    dto: UpdateTimetableDto,
    context: RequestContext,
  ): Promise<{ updated: boolean }> {
    const existing = await this.prisma.classTimetable.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('[ERR-TT-4041] Timetable entry not found');
    }

    try {
      await this.prisma.classTimetable.updateMany({
        where: { id, tenantId: context.tenantId },
        data: {
          ...(dto.periodId   !== undefined && { periodId:  dto.periodId   }),
          ...(dto.dayOfWeek  !== undefined && { dayOfWeek: dto.dayOfWeek  }),
          ...(dto.subjectId  !== undefined && { subjectId: dto.subjectId  }),
          ...(dto.teacherId  !== undefined && { teacherId: dto.teacherId  }),
          updatedBy: context.userId,
        },
      });
      return { updated: true };
    } catch (e: unknown) {
      this.handlePrismaConflict(e);
      throw e;
    }
  }

  async deleteEntry(
    id: string,
    context: RequestContext,
  ): Promise<{ deleted: boolean }> {
    const result = await this.prisma.classTimetable.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: { softDelete: true, updatedBy: context.userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('[ERR-TT-4042] Timetable entry not found');
    }
    return { deleted: true };
  }

  // ── Matrix Aggregation ────────────────────────────────────────────────────

  async getMatrix(
    tenantId: string,
    academicYearId: string,
    classId: string,
    sectionId: string,
  ) {
    // Parallel fetch: periods (tenant-wide, ordered by time) + timetable entries
    const [periods, entries] = await Promise.all([
      this.prisma.period.findMany({
        where: { tenantId, softDelete: false },
        select: {
          id:        true,
          name:      true,
          startTime: true,
          endTime:   true,
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.classTimetable.findMany({
        where: { tenantId, academicYearId, classId, sectionId, softDelete: false },
        select: {
          id:        true,
          dayOfWeek: true,
          periodId:  true,
          subjectId: true,
          teacherId: true,
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
    ]);

    // Build a map: dayOfWeek -> periodId -> entry
    const matrix: Record<string, Record<string, typeof entries[0] | null>> = {};
    for (const day of ALL_DAYS) {
      matrix[day] = {};
      for (const p of periods) {
        matrix[day][p.id] = null;
      }
    }
    for (const entry of entries) {
      if (matrix[entry.dayOfWeek]) {
        matrix[entry.dayOfWeek][entry.periodId] = entry;
      }
    }

    return {
      days:    ALL_DAYS,
      periods,
      matrix,
    };
  }

  // ── TimeTableEntry (day-agnostic 2-D grid) ────────────────────────────────

  async getEntries(tenantId: string, academicYearId: string) {
    const [periods, classes, entries] = await Promise.all([
      this.prisma.period.findMany({
        where: { tenantId, softDelete: false },
        select: { id: true, name: true, startTime: true, endTime: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.class.findMany({
        where: { tenantId, academicYearId, softDelete: false },
        select: {
          id: true,
          name: true,
          code: true,
          sections: {
            where: { softDelete: false },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          },
        },
        // Initial DB fetch ordered by code; natural numeric re-sort applied below
        orderBy: { code: 'asc' },
      }).then(rows => {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        return rows.sort((a, b) => collator.compare(a.name, b.name));
      }),
      this.prisma.timeTableEntry.findMany({
        where: { tenantId, academicYearId, softDelete: false },
        select: {
          id:        true,
          classId:   true,
          sectionId: true,
          periodId:  true,
          subject:   { select: { id: true, name: true, code: true } },
          teacher:   { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
    ]);
    // Ensure sections are always an array (defensive normalisation)
    const normalisedClasses = classes.map(c => ({
      ...c,
      sections: c.sections ?? [],
    }));
    return { periods, classes: normalisedClasses, entries };
  }

  async upsertEntry(
    dto: {
      academicYearId: string;
      classId: string;
      sectionId: string | null;     // null for classes with no sections
      periodId: string;
      subjectId?: string | null;
      teacherId?: string | null;
    },
    context: RequestContext,
  ): Promise<{ id: string }> {
    const sectionId = dto.sectionId || null;   // coerce '' → null for FK safety

    // Teacher double-booking check: same teacher cannot teach two classes simultaneously
    if (dto.teacherId) {
      const conflict = await this.prisma.timeTableEntry.findFirst({
        where: {
          tenantId:       context.tenantId,
          academicYearId: dto.academicYearId,
          periodId:       dto.periodId,
          teacherId:      dto.teacherId,
          softDelete:     false,
          NOT: { classId: dto.classId, sectionId },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException(
          'Teacher is already assigned to another class during this period.',
        );
      }
    }

    // Prisma's WhereUniqueInput does not accept null in compound unique fields
    // (SQL NULL ≠ NULL, so it can't be a reliable unique key).
    // We use a manual findFirst → update/create instead.
    const existing = await this.prisma.timeTableEntry.findFirst({
      where: {
        tenantId:       context.tenantId,
        academicYearId: dto.academicYearId,
        classId:        dto.classId,
        sectionId,          // generates: IS NULL when null, = ? when string
        periodId:       dto.periodId,
        softDelete:     false,
      },
      select: { id: true },
    });

    let entry: { id: string };
    if (existing) {
      entry = await this.prisma.timeTableEntry.update({
        where: { id: existing.id },
        data: {
          subjectId: dto.subjectId ?? null,
          teacherId: dto.teacherId ?? null,
          updatedBy: context.userId,
          softDelete: false,
        },
        select: { id: true },
      });
    } else {
      entry = await this.prisma.timeTableEntry.create({
        data: {
          tenantId:       context.tenantId,
          academicYearId: dto.academicYearId,
          classId:        dto.classId,
          sectionId,
          periodId:       dto.periodId,
          subjectId:      dto.subjectId ?? null,
          teacherId:      dto.teacherId ?? null,
          createdBy:      context.userId,
          updatedBy:      context.userId,
          softDelete:     false,
        },
        select: { id: true },
      });
    }
    return { id: entry.id };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private handlePrismaConflict(e: unknown): void {
    if (
      e !== null &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code: string }).code === 'P2002'
    ) {
      const target = (e as { meta?: { target?: string[] } }).meta?.target ?? [];
      if (target.includes('teacherId') || target.join(',').includes('teacherId')) {
        throw new ConflictException(
          'This teacher is already assigned to another class during this period.',
        );
      }
      throw new ConflictException(
        'A timetable entry already exists for this class at this period and day.',
      );
    }
  }
}
