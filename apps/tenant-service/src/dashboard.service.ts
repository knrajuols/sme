import { Injectable } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';

export interface AdminSummary {
  totalStudents: number;
  totalTeachers: number;
  attendance: {
    presentToday: number;
    totalToday: number;
    percentage: number;
  };
  upcomingExams: Array<{
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    classId: string;
    status: string;
  }>;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminSummary(tenantId: string): Promise<AdminSummary> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    // All queries run in parallel — no sequential awaits.
    const [
      totalStudents,
      totalTeachers,
      presentToday,
      totalToday,
      upcomingExams,
    ] = await Promise.all([
      // 1. Active students
      this.prisma.student.count({
        where: { tenantId, status: 'ACTIVE', softDelete: false },
      }),

      // 2. Active teachers
      this.prisma.teacher.count({
        where: { tenantId, isActive: true, softDelete: false },
      }),

      // 3. PRESENT attendance records today
      this.prisma.attendanceRecord.count({
        where: {
          tenantId,
          softDelete: false,
          status: 'PRESENT',
          session: {
            tenantId,
            date: { gte: todayStart, lte: todayEnd },
            softDelete: false,
          },
        },
      }),

      // 4. Total attendance records today (any status)
      this.prisma.attendanceRecord.count({
        where: {
          tenantId,
          softDelete: false,
          session: {
            tenantId,
            date: { gte: todayStart, lte: todayEnd },
            softDelete: false,
          },
        },
      }),

      // 5. Top 3 upcoming exams (startDate >= today)
      this.prisma.exam.findMany({
        where: {
          tenantId,
          softDelete: false,
          startDate: { gte: todayStart },
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          classId: true,
          status: true,
        },
        orderBy: { startDate: 'asc' },
        take: 3,
      }),
    ]);

    const percentage =
      totalToday > 0 ? parseFloat(((presentToday / totalToday) * 100).toFixed(1)) : 0;

    return {
      totalStudents,
      totalTeachers,
      attendance: { presentToday, totalToday, percentage },
      upcomingExams: upcomingExams.map((e) => ({
        id:        e.id,
        name:      e.name,
        startDate: e.startDate,
        endDate:   e.endDate,
        classId:   e.classId,
        status:    e.status,
      })),
    };
  }
}
