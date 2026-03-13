import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, PermissionGuard, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';
import type { Request } from 'express';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { AcademicService } from './academic.service';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { UpdateExamScheduleDto } from './dto/update-exam-schedule.dto';

interface RequestWithContext extends Request {
  user: JwtClaims;
  tenantId: string;
}

@ApiTags('Exam Schedules')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard, RolesGuard)
@Roles('SCHOOL_ADMIN')
export class ExamScheduleController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('exam-schedules')
  @ApiOperation({ summary: 'List exam schedules for the calling tenant' })
  @Permissions('EXAM_CREATE')
  list(@Req() req: RequestWithContext) {
    return this.academicService.listExamSchedules(req.tenantId);
  }

  @Post('exam-schedules')
  @ApiOperation({ summary: 'Create a new exam schedule' })
  @Permissions('EXAM_CREATE')
  create(@Body() dto: CreateExamScheduleDto, @Req() req: RequestWithContext) {
    if (!dto.academicYearId?.trim()) {
      throw new BadRequestException('academicYearId is required for school exam schedules');
    }
    return this.academicService.createExamSchedule(dto, {
      tenantId:      req.tenantId,
      userId:        req.user.sub,
      role:          req.user.roles[0] ?? 'SCHOOL_ADMIN',
      correlationId: this.corrId(req),
    });
  }

  @Patch('exam-schedules/:id')
  @ApiOperation({ summary: 'Update an exam schedule' })
  @Permissions('EXAM_CREATE')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExamScheduleDto,
    @Req() req: RequestWithContext,
  ) {
    return this.academicService.updateExamSchedule(id, dto, {
      tenantId:      req.tenantId,
      userId:        req.user.sub,
      role:          req.user.roles[0] ?? 'SCHOOL_ADMIN',
      correlationId: this.corrId(req),
    });
  }

  @Delete('exam-schedules/:id')
  @ApiOperation({ summary: 'Soft-delete an exam schedule' })
  @Permissions('EXAM_CREATE')
  remove(@Param('id') id: string, @Req() req: RequestWithContext) {
    return this.academicService.deleteExamSchedule(id, {
      tenantId:      req.tenantId,
      userId:        req.user.sub,
      role:          req.user.roles[0] ?? 'SCHOOL_ADMIN',
      correlationId: this.corrId(req),
    });
  }

  @Post('exam-schedules/generate-from-master')
  @ApiOperation({ summary: 'Generate exam schedules from master template' })
  @Permissions('EXAM_CREATE')
  generateFromMaster(
    @Body('academicYearId') academicYearId: string,
    @Req() req: RequestWithContext,
  ) {
    return this.academicService.generateExamSchedulesFromMaster(academicYearId, {
      tenantId:      req.tenantId,
      userId:        req.user.sub,
      role:          req.user.roles[0] ?? 'SCHOOL_ADMIN',
      correlationId: this.corrId(req),
    });
  }

  private corrId(req: Request): string {
    const h = req.headers['x-correlation-id'];
    if (Array.isArray(h)) return h[0] ?? 'tenant-service';
    return (typeof h === 'string' && h) ? h : 'tenant-service';
  }
}
