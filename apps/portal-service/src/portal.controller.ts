import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import {
  CurrentTenant,
  CurrentUser,
  Permissions,
} from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { PortalService } from './portal.service';

@ApiTags('Portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get parent profile' })
  @Permissions('PORTAL_VIEW')
  async profile(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    relation: string;
  }> {
    return this.portalService.getProfile({
      tenantId,
      user,
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('students')
  @ApiOperation({ summary: 'Get mapped students for parent' })
  @Permissions('PORTAL_VIEW')
  async students(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<Array<{
    studentId: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    status: string;
  }>> {
    return this.portalService.getStudents({
      tenantId,
      user,
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('students/:id/attendance')
  @ApiOperation({ summary: 'Get attendance summary for a mapped student' })
  @Permissions('PORTAL_VIEW')
  async attendance(
    @Param('id') studentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ totalDays: number; presentDays: number; absentDays: number; percentage: number }> {
    return this.portalService.getStudentAttendance(studentId, {
      tenantId,
      user,
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('students/:id/results')
  @ApiOperation({ summary: 'Get exam results for a mapped student' })
  @Permissions('PORTAL_VIEW')
  async results(
    @Param('id') studentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<Array<{
    examId: string;
    examName: string;
    totalMarks: number;
    percentage: number;
    grade: string;
    classRank: number | null;
    sectionRank: number | null;
    gpa: number | null;
  }>> {
    return this.portalService.getStudentResults(studentId, {
      tenantId,
      user,
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('students/:id/analytics')
  @ApiOperation({ summary: 'Get dashboard analytics for a mapped student' })
  @Permissions('PORTAL_VIEW')
  async analytics(
    @Param('id') studentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{
    studentProfile: {
      studentId: string;
      admissionNumber: string;
      firstName: string;
      lastName: string;
      status: string;
    };
    attendanceSummary: { totalDays: number; presentDays: number; absentDays: number; percentage: number };
    latestExamResult: {
      examId: string;
      examName: string;
      totalMarks: number;
      percentage: number;
      grade: string;
    } | null;
    rank: { classRank: number | null; sectionRank: number | null };
    gpa: number | null;
    correlationLabel: string;
  }> {
    return this.portalService.getStudentAnalytics(studentId, {
      tenantId,
      user,
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }
}
