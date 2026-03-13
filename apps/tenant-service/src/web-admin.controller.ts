import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentUser, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { AcademicService } from './academic.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { UpdateExamScheduleDto } from './dto/update-exam-schedule.dto';

/** Reserved tenantId for the platform-managed master template partition. */
const MASTER_TEMPLATE = 'MASTER_TEMPLATE';

/**
 * Web-Admin Control Plane — period template management.
 *
 * All operations target the MASTER_TEMPLATE tenant partition.
 * Routes are protected by the PLATFORM_ADMIN role.
 */
@ApiTags('Web-Admin')
@Controller('web-admin')
@UseGuards(RolesGuard)
@Roles('PLATFORM_ADMIN')
export class WebAdminController {
  constructor(private readonly academicService: AcademicService) {}

  // ── Master Template: Periods ──────────────────────────────────────────────

  @Get('periods')
  @ApiOperation({ summary: 'List all master template periods' })
  @Permissions('TENANT_CREATE')
  async listMasterPeriods() {
    return this.academicService.listPeriods(MASTER_TEMPLATE);
  }

  @Post('periods')
  @ApiOperation({ summary: 'Create a period in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterPeriod(
    @Body() dto: CreatePeriodDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createPeriod(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('periods/seed')
  @ApiOperation({ summary: 'Seed the canonical 10-slot schedule into the master template' })
  @Permissions('TENANT_CREATE')
  async seedMasterPeriods(
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedMasterPeriods({
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('periods/:id')
  @ApiOperation({ summary: 'Get a single master template period' })
  @Permissions('TENANT_CREATE')
  async getMasterPeriod(@Param('id') id: string) {
    return this.academicService.getPeriod(id, MASTER_TEMPLATE);
  }

  @Patch('periods/:id')
  @ApiOperation({ summary: 'Update a master template period' })
  @Permissions('TENANT_CREATE')
  async updateMasterPeriod(
    @Param('id') id: string,
    @Body() dto: UpdatePeriodDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean; cascaded: number }> {
    return this.academicService.updatePeriod(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('periods/:id')
  @ApiOperation({ summary: 'Soft-delete a master template period' })
  @Permissions('TENANT_CREATE')
  async deleteMasterPeriod(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deletePeriod(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Master Template: Exam Schedules ──────────────────────────────────────

  @Get('exam-schedules')
  @ApiOperation({ summary: 'List all master template exam schedules' })
  @Permissions('TENANT_CREATE')
  async listMasterExamSchedules() {
    return this.academicService.listExamSchedules(MASTER_TEMPLATE);
  }

  @Post('exam-schedules')
  @ApiOperation({ summary: 'Create an exam schedule in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterExamSchedule(
    @Body() dto: CreateExamScheduleDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createExamSchedule(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('exam-schedules/:id')
  @ApiOperation({ summary: 'Update a master template exam schedule' })
  @Permissions('TENANT_CREATE')
  async updateMasterExamSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateExamScheduleDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateExamSchedule(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('exam-schedules/:id')
  @ApiOperation({ summary: 'Soft-delete a master template exam schedule' })
  @Permissions('TENANT_CREATE')
  async deleteMasterExamSchedule(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteExamSchedule(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Master Template: Academic Years ──────────────────────────────────────

  @Get('academic-years')
  @ApiOperation({ summary: 'List academic years in the master template partition' })
  @Permissions('TENANT_CREATE')
  async listMasterAcademicYears() {
    return this.academicService.listAcademicYears(MASTER_TEMPLATE);
  }
}
