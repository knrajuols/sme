import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import {
  CurrentTenant,
  CurrentUser,
  Permissions,
} from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AttendanceService } from './attendance.service';
import { AttendanceSessionQueryDto } from './dto/attendance-session-query.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create attendance session' })
  @Permissions('ATTENDANCE_SESSION_CREATE')
  async createSession(
    @Body() dto: CreateAttendanceSessionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.attendanceService.createSession(dto, {
      tenantId,
      user,
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('records')
  @ApiOperation({ summary: 'Mark attendance records' })
  @Permissions('ATTENDANCE_MARK')
  async markAttendance(
    @Body() dto: CreateAttendanceRecordDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ recordCount: number }> {
    return this.attendanceService.markAttendance(dto, {
      tenantId,
      user,
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('sessions/:id/close')
  @ApiOperation({ summary: 'Close attendance session' })
  @Permissions('ATTENDANCE_MARK')
  async closeSession(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string; status: string }> {
    return this.attendanceService.closeSession(id, {
      tenantId,
      user,
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get attendance session by ID' })
  @Permissions('ATTENDANCE_VIEW')
  async getSessionById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    id: string;
    date: Date;
    classId: string;
    sectionId: string;
    academicYearId: string;
    status: string;
    records: Array<{ studentId: string; status: string; remarks: string | null }>;
    enrolledStudentIds: string[];
  }> {
    return this.attendanceService.getSessionById(id, tenantId);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Find attendance sessions by date/class/section' })
  @Permissions('ATTENDANCE_VIEW')
  async listSessions(
    @Query() query: AttendanceSessionQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    id: string;
    date: Date;
    classId: string;
    sectionId: string;
    academicYearId: string;
    status: string;
  }>> {
    return this.attendanceService.listSessions(query, tenantId);
  }

  @Get('students/:studentId/summary')
  @ApiOperation({ summary: 'Get attendance summary for student' })
  @Permissions('ATTENDANCE_VIEW')
  async getStudentSummary(
    @Param('studentId') studentId: string,
    @Query() query: AttendanceSummaryQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ totalDays: number; presentDays: number; absentDays: number; percentage: number }> {
    return this.attendanceService.getStudentSummary(studentId, query, tenantId);
  }
}