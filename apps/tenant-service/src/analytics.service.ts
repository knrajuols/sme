import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';

interface StudentRankingRow {
  studentId: string;
  totalMarks: number;
  percentage: number;
  grade: string;
  classRank: number | null;
  sectionRank: number | null;
  gpa: number | null;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClassSummary(examId: string, tenantId: string): Promise<{
    examId: string;
    classId: string;
    averageMarks: number;
    averagePercentage: number;
    highestMarks: number;
    lowestMarks: number;
    passPercentage: number;
  }> {
    await this.assertExam(examId, tenantId);

    const rows = await this.prisma.$queryRaw<Array<{
      examId: string;
      classId: string;
      averageMarks: number;
      averagePercentage: number;
      highestMarks: number;
      lowestMarks: number;
      passPercentage: number;
    }>>`
      SELECT
        "examId",
        "classId",
        "averageMarks",
        "averagePercentage",
        "highestMarks",
        "lowestMarks",
        "passPercentage"
      FROM "ClassExamAggregate"
      WHERE "tenantId" = ${tenantId}
        AND "examId" = ${examId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const summary = rows[0];
    if (!summary) {
      throw new NotFoundException('Class analytics not found for exam');
    }

    return summary;
  }

  async getSubjectSummary(examId: string, tenantId: string): Promise<Array<{
    subjectId: string;
    averageMarks: number;
    highestMarks: number;
    lowestMarks: number;
    passPercentage: number;
  }>> {
    await this.assertExam(examId, tenantId);

    return this.prisma.$queryRaw<Array<{
      subjectId: string;
      averageMarks: number;
      highestMarks: number;
      lowestMarks: number;
      passPercentage: number;
    }>>`
      SELECT
        "subjectId",
        "averageMarks",
        "highestMarks",
        "lowestMarks",
        "passPercentage"
      FROM "SubjectExamAnalytics"
      WHERE "tenantId" = ${tenantId}
        AND "examId" = ${examId}
        AND "softDelete" = false
      ORDER BY "subjectId" ASC
    `;
  }

  async getRankings(examId: string, tenantId: string): Promise<StudentRankingRow[]> {
    await this.assertExam(examId, tenantId);

    return this.prisma.$queryRaw<StudentRankingRow[]>`
      SELECT
        "studentId",
        "totalMarks",
        "percentage",
        "grade",
        "classRank",
        "sectionRank",
        "gpa"
      FROM "StudentExamAggregate"
      WHERE "tenantId" = ${tenantId}
        AND "examId" = ${examId}
        AND "softDelete" = false
      ORDER BY "classRank" ASC NULLS LAST, "studentId" ASC
    `;
  }

  async getStudentPerformance(studentId: string, tenantId: string): Promise<Array<{
    examId: string;
    totalMarks: number;
    percentage: number;
    grade: string;
    classRank: number | null;
    sectionRank: number | null;
    gpa: number | null;
  }>> {
    await this.assertStudent(studentId, tenantId);

    return this.prisma.$queryRaw<Array<{
      examId: string;
      totalMarks: number;
      percentage: number;
      grade: string;
      classRank: number | null;
      sectionRank: number | null;
      gpa: number | null;
    }>>`
      SELECT
        "examId",
        "totalMarks",
        "percentage",
        "grade",
        "classRank",
        "sectionRank",
        "gpa"
      FROM "StudentExamAggregate"
      WHERE "tenantId" = ${tenantId}
        AND "studentId" = ${studentId}
        AND "softDelete" = false
      ORDER BY "createdAt" DESC
    `;
  }

  async getStudentCorrelation(
    studentId: string,
    examId: string,
    tenantId: string,
  ): Promise<{
    attendancePercentage: number;
    examPercentage: number;
    correlationLabel: string;
  }> {
    await this.assertStudent(studentId, tenantId);

    const examRows = await this.prisma.$queryRaw<Array<{ id: string; startDate: Date; endDate: Date }>>`
      SELECT "id", "startDate", "endDate"
      FROM "Exam"
      WHERE "id" = ${examId}
        AND "tenantId" = ${tenantId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const exam = examRows[0];
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    const aggregateRows = await this.prisma.$queryRaw<Array<{ percentage: number }>>`
      SELECT "percentage"
      FROM "StudentExamAggregate"
      WHERE "tenantId" = ${tenantId}
        AND "examId" = ${examId}
        AND "studentId" = ${studentId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const aggregate = aggregateRows[0];
    if (!aggregate) {
      throw new NotFoundException('Student exam aggregate not found');
    }

    const attendanceRows = await this.prisma.$queryRaw<Array<{ status: string }>>`
      SELECT ar."status"
      FROM "AttendanceRecord" ar
      INNER JOIN "AttendanceSession" session
        ON session."id" = ar."sessionId"
       AND session."tenantId" = ar."tenantId"
      WHERE ar."tenantId" = ${tenantId}
        AND ar."studentId" = ${studentId}
        AND ar."softDelete" = false
        AND session."softDelete" = false
        AND session."date" >= ${exam.startDate}::date
        AND session."date" <= ${exam.endDate}::date
    `;

    const totalDays = attendanceRows.length;
    const presentDays = attendanceRows.filter((row) => row.status === 'PRESENT' || row.status === 'LATE').length;
    const attendancePercentage = totalDays === 0 ? 0 : Number(((presentDays / totalDays) * 100).toFixed(2));
    const examPercentage = Number(aggregate.percentage.toFixed(2));

    const highAttendance = attendancePercentage >= 75;
    const highScore = examPercentage >= 60;

    let correlationLabel = 'LOW_ATTENDANCE_LOW_SCORE';
    if (highAttendance && highScore) {
      correlationLabel = 'HIGH_ATTENDANCE_HIGH_SCORE';
    } else if (highAttendance && !highScore) {
      correlationLabel = 'HIGH_ATTENDANCE_LOW_SCORE';
    } else if (!highAttendance && highScore) {
      correlationLabel = 'LOW_ATTENDANCE_HIGH_SCORE';
    }

    return {
      attendancePercentage,
      examPercentage,
      correlationLabel,
    };
  }

  private async assertExam(examId: string, tenantId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Exam"
      WHERE "id" = ${examId}
        AND "tenantId" = ${tenantId}
        AND "softDelete" = false
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Exam not found');
    }
  }

  private async assertStudent(studentId: string, tenantId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Student"
      WHERE "id" = ${studentId}
        AND "tenantId" = ${tenantId}
        AND "softDelete" = false
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException('Student not found');
    }
  }
}
