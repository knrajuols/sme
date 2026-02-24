import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentTenant,
  Permissions,
} from '@sme/auth';

import { AnalyticsCorrelationQueryDto } from './dto/analytics-correlation-query.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('exams/:examId/class-summary')
  @ApiOperation({ summary: 'Get class-level exam analytics summary' })
  @Permissions('ANALYTICS_VIEW')
  async getClassSummary(
    @Param('examId') examId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    examId: string;
    classId: string;
    averageMarks: number;
    averagePercentage: number;
    highestMarks: number;
    lowestMarks: number;
    passPercentage: number;
  }> {
    return this.analyticsService.getClassSummary(examId, tenantId);
  }

  @Get('exams/:examId/subject-summary')
  @ApiOperation({ summary: 'Get subject-level exam analytics summary' })
  @Permissions('ANALYTICS_VIEW')
  async getSubjectSummary(
    @Param('examId') examId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    subjectId: string;
    averageMarks: number;
    highestMarks: number;
    lowestMarks: number;
    passPercentage: number;
  }>> {
    return this.analyticsService.getSubjectSummary(examId, tenantId);
  }

  @Get('exams/:examId/rankings')
  @ApiOperation({ summary: 'Get ranked student analytics for exam' })
  @Permissions('ANALYTICS_VIEW')
  async getRankings(
    @Param('examId') examId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    studentId: string;
    totalMarks: number;
    percentage: number;
    grade: string;
    classRank: number | null;
    sectionRank: number | null;
    gpa: number | null;
  }>> {
    return this.analyticsService.getRankings(examId, tenantId);
  }

  @Get('students/:studentId/performance')
  @ApiOperation({ summary: 'Get performance analytics for student' })
  @Permissions('ANALYTICS_VIEW')
  async getStudentPerformance(
    @Param('studentId') studentId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    examId: string;
    totalMarks: number;
    percentage: number;
    grade: string;
    classRank: number | null;
    sectionRank: number | null;
    gpa: number | null;
  }>> {
    return this.analyticsService.getStudentPerformance(studentId, tenantId);
  }

  @Get('students/:studentId/correlation')
  @ApiOperation({ summary: 'Get attendance to performance correlation label for student' })
  @Permissions('ANALYTICS_VIEW')
  async getStudentCorrelation(
    @Param('studentId') studentId: string,
    @Query() query: AnalyticsCorrelationQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    attendancePercentage: number;
    examPercentage: number;
    correlationLabel: string;
  }> {
    return this.analyticsService.getStudentCorrelation(studentId, query.examId, tenantId);
  }
}
