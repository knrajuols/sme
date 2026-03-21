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
import { FinanceService } from './finance.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { UpdateExamScheduleDto } from './dto/update-exam-schedule.dto';
import { CreateGradeScaleDto } from './dto/create-grade-scale.dto';
import { UpdateGradeScaleDto } from './dto/update-grade-scale.dto';
import { CreateFeeCategoryDto } from './dto/create-fee-category.dto';
import { UpdateFeeCategoryDto } from './dto/update-fee-category.dto';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import {
  SaveWeekendConfigDto,
  SaveMatrixRulesDto,
  GenerateHolidaysDto,
  CreateHolidayEntryDto,
  UpdateHolidayEntryDto,
} from './dto/holiday-engine.dto';
import { NamingStyle } from './dto/seed-sections.dto';

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
  constructor(
    private readonly academicService: AcademicService,
    private readonly financeService: FinanceService,
  ) {}

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

  @Post('academic-years')
  @ApiOperation({ summary: 'Create an academic year in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterAcademicYear(
    @Body() dto: CreateAcademicYearDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createAcademicYear(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('academic-years/:id')
  @ApiOperation({ summary: 'Update a master template academic year' })
  @Permissions('TENANT_CREATE')
  async updateMasterAcademicYear(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateAcademicYear(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('academic-years/:id')
  @ApiOperation({ summary: 'Soft-delete a master template academic year' })
  @Permissions('TENANT_CREATE')
  async deleteMasterAcademicYear(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteAcademicYear(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('academic-years/seed')
  @ApiOperation({ summary: 'Seed sample academic years into the master template' })
  @Permissions('TENANT_CREATE')
  async seedMasterAcademicYears(
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedAcademicYears({
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Master Template: Classes ─────────────────────────────────────────────

  @Get('classes')
  @ApiOperation({ summary: 'List classes in the master template (optional academicYearId filter)' })
  @Permissions('TENANT_CREATE')
  async listMasterClasses(@Query('academicYearId') academicYearId?: string) {
    return this.academicService.listClasses(MASTER_TEMPLATE, academicYearId);
  }

  @Post('classes')
  @ApiOperation({ summary: 'Create a class in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterClass(
    @Body() dto: CreateClassDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createClass(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('classes/:id')
  @ApiOperation({ summary: 'Update a master template class' })
  @Permissions('TENANT_CREATE')
  async updateMasterClass(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateClass(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('classes/:id')
  @ApiOperation({ summary: 'Soft-delete a master template class' })
  @Permissions('TENANT_CREATE')
  async deleteMasterClass(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteClass(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('classes/seed')
  @ApiOperation({ summary: 'Seed Class 1–12 into the master template' })
  @Permissions('TENANT_CREATE')
  async seedMasterClasses(
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedClasses({
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Master Template: Sections ────────────────────────────────────────────

  @Get('sections')
  @ApiOperation({ summary: 'List sections in the master template' })
  @Permissions('TENANT_CREATE')
  async listMasterSections() {
    return this.academicService.listSections(MASTER_TEMPLATE);
  }

  @Post('sections')
  @ApiOperation({ summary: 'Create a section in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterSection(
    @Body() dto: CreateSectionDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createSection(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('sections/:id')
  @ApiOperation({ summary: 'Update a master template section' })
  @Permissions('TENANT_CREATE')
  async updateMasterSection(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateSection(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('sections/:id')
  @ApiOperation({ summary: 'Soft-delete a master template section' })
  @Permissions('TENANT_CREATE')
  async deleteMasterSection(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteSection(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('sections/seed')
  @ApiOperation({ summary: 'Seed sections into the master template' })
  @Permissions('TENANT_CREATE')
  async seedMasterSections(
    @Body() body: { namingStyle: 'ALPHABETIC' | 'THEMATIC' },
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    const style = body.namingStyle === 'THEMATIC' ? NamingStyle.THEMATIC : NamingStyle.ALPHABETIC;
    return this.academicService.seedSections(
      {
        tenantId: MASTER_TEMPLATE,
        userId: user.sub,
        role: user.roles[0] ?? 'PLATFORM_ADMIN',
        correlationId: correlationIdHeader ?? randomUUID(),
      },
      style,
    );
  }

  // ── Master Template: Subjects ────────────────────────────────────────────

  @Get('subjects')
  @ApiOperation({ summary: 'List subjects in the master template' })
  @Permissions('TENANT_CREATE')
  async listMasterSubjects() {
    return this.academicService.listSubjects(MASTER_TEMPLATE);
  }

  @Post('subjects')
  @ApiOperation({ summary: 'Create a subject in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterSubject(
    @Body() dto: CreateSubjectDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createSubject(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('subjects/:id/status')
  @ApiOperation({ summary: 'Toggle subject ACTIVE/INACTIVE in the master template' })
  @Permissions('TENANT_CREATE')
  async updateMasterSubjectStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'INACTIVE' },
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateSubjectStatus(id, body.status, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('subjects/:id')
  @ApiOperation({ summary: 'Update a master template subject' })
  @Permissions('TENANT_CREATE')
  async updateMasterSubject(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateSubject(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('subjects/:id')
  @ApiOperation({ summary: 'Soft-delete a master template subject' })
  @Permissions('TENANT_CREATE')
  async deleteMasterSubject(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteSubject(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('subjects/seed')
  @ApiOperation({ summary: 'Seed CBSE subjects into the master template' })
  @Permissions('TENANT_CREATE')
  async seedMasterSubjects(
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedSubjects({
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Master Template: Grading System (CBSE Grade Scales) ──────────────────

  @Get('grading-system')
  @ApiOperation({ summary: 'List all grading system entries in the master template' })
  @Permissions('TENANT_CREATE')
  async listMasterGradeScales() {
    return this.academicService.listGradeScales(MASTER_TEMPLATE);
  }

  @Post('grading-system')
  @ApiOperation({ summary: 'Create a grading system entry in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterGradeScale(
    @Body() dto: CreateGradeScaleDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createGradeScale(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('grading-system/:id')
  @ApiOperation({ summary: 'Get a single grading system entry' })
  @Permissions('TENANT_CREATE')
  async getMasterGradeScale(@Param('id') id: string) {
    return this.academicService.getGradeScale(id, MASTER_TEMPLATE);
  }

  @Patch('grading-system/:id')
  @ApiOperation({ summary: 'Update a grading system entry in the master template' })
  @Permissions('TENANT_CREATE')
  async updateMasterGradeScale(
    @Param('id') id: string,
    @Body() dto: UpdateGradeScaleDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateGradeScale(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('grading-system/:id')
  @ApiOperation({ summary: 'Soft-delete a grading system entry from the master template' })
  @Permissions('TENANT_CREATE')
  async deleteMasterGradeScale(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteGradeScale(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Master Template: Fee Categories ──────────────────────────────────────

  @Get('fee-categories')
  @ApiOperation({ summary: 'List all master template fee categories' })
  @Permissions('TENANT_CREATE')
  async listMasterFeeCategories() {
    return this.financeService.listFeeCategories(MASTER_TEMPLATE);
  }

  @Post('fee-categories')
  @ApiOperation({ summary: 'Create a fee category in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterFeeCategory(
    @Body() dto: CreateFeeCategoryDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.financeService.createFeeCategory(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('fee-categories/:id')
  @ApiOperation({ summary: 'Update a master template fee category' })
  @Permissions('TENANT_CREATE')
  async updateMasterFeeCategory(
    @Param('id') id: string,
    @Body() dto: UpdateFeeCategoryDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.financeService.updateFeeCategory(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('fee-categories/:id')
  @ApiOperation({ summary: 'Soft-delete a master template fee category' })
  @Permissions('TENANT_CREATE')
  async deleteMasterFeeCategory(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.financeService.deleteFeeCategory(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Master Template: Fee Structures ──────────────────────────────────────

  @Get('fee-structures')
  @ApiOperation({ summary: 'List master template fee structures (filter by academicYearId/classId)' })
  @Permissions('TENANT_CREATE')
  async listMasterFeeStructures(
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.financeService.listFeeStructures(MASTER_TEMPLATE, { academicYearId, classId });
  }

  @Post('fee-structures')
  @ApiOperation({ summary: 'Create a fee structure in the master template' })
  @Permissions('TENANT_CREATE')
  async createMasterFeeStructure(
    @Body() dto: CreateFeeStructureDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.financeService.createFeeStructure(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('fee-structures/seed')
  @ApiOperation({ summary: 'Seed standard Indian K-12 fee structures for master template' })
  @Permissions('TENANT_CREATE')
  async seedMasterFeeStructures(
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ created: number; skipped: number }> {
    return this.financeService.seedFeeStructures({
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('fee-structures/:id')
  @ApiOperation({ summary: 'Update a master template fee structure' })
  @Permissions('TENANT_CREATE')
  async updateMasterFeeStructure(
    @Param('id') id: string,
    @Body() dto: UpdateFeeStructureDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.financeService.updateFeeStructure(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('fee-structures/:id')
  @ApiOperation({ summary: 'Soft-delete a master template fee structure' })
  @Permissions('TENANT_CREATE')
  async deleteMasterFeeStructure(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.financeService.deleteFeeStructure(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Master Template: Academic Calendar ────────────────────────────────────

  @Get('academic-calendar/template')
  @ApiOperation({ summary: 'Download the academic calendar CSV template' })
  @Permissions('TENANT_CREATE')
  downloadCalendarTemplate() {
    return { content: this.academicService.getCalendarTemplate() };
  }

  @Post('academic-calendar/validate')
  @ApiOperation({ summary: 'Validate academic calendar CSV before uploading' })
  @Permissions('TENANT_CREATE')
  async validateCalendarCsv(
    @Body() body: { csvContent: string; academicYearName: string; academicYearId?: string },
  ) {
    // Look up the academic year's date range so dates outside the window are flagged
    let ayStartDate: Date | undefined;
    let ayEndDate: Date | undefined;
    if (body.academicYearId) {
      const ay = await this.academicService.getAcademicYearById(MASTER_TEMPLATE, body.academicYearId);
      if (ay) { ayStartDate = ay.startDate; ayEndDate = ay.endDate; }
    }
    return this.academicService.validateAcademicCalendarCsv(
      body.csvContent,
      body.academicYearName,
      ayStartDate,
      ayEndDate,
    );
  }

  @Post('academic-calendar/upload')
  @ApiOperation({ summary: 'Upload validated academic calendar entries' })
  @Permissions('TENANT_CREATE')
  async uploadCalendar(
    @Body() body: { csvContent: string; academicYearId: string },
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.uploadAcademicCalendar(
      body.csvContent,
      body.academicYearId,
      {
        tenantId: MASTER_TEMPLATE,
        userId: user.sub,
        role: user.roles[0] ?? 'PLATFORM_ADMIN',
        correlationId: correlationIdHeader ?? randomUUID(),
      },
    );
  }

  @Get('academic-calendar')
  @ApiOperation({ summary: 'List academic calendar entries for an academic year' })
  @Permissions('TENANT_CREATE')
  async listCalendar(
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.academicService.listAcademicCalendar(MASTER_TEMPLATE, academicYearId);
  }

  // ── Master Template: Holiday Engine ───────────────────────────────────────

  @Post('holidays/weekend-config')
  @ApiOperation({ summary: 'Save weekend holiday configuration' })
  @Permissions('TENANT_CREATE')
  async saveWeekendConfig(
    @Body() dto: SaveWeekendConfigDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.saveWeekendConfig(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('holidays/weekend-config')
  @ApiOperation({ summary: 'Get weekend holiday configuration' })
  @Permissions('TENANT_CREATE')
  async getWeekendConfig(
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.academicService.getWeekendConfig(MASTER_TEMPLATE, academicYearId);
  }

  @Post('holidays/matrix-rules')
  @ApiOperation({ summary: 'Save monthly holiday matrix rules' })
  @Permissions('TENANT_CREATE')
  async saveMatrixRules(
    @Body() dto: SaveMatrixRulesDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.saveMatrixRules(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('holidays/matrix-rules')
  @ApiOperation({ summary: 'Get monthly holiday matrix rules' })
  @Permissions('TENANT_CREATE')
  async getMatrixRules(
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.academicService.getMatrixRules(MASTER_TEMPLATE, academicYearId);
  }

  @Post('holidays/generate')
  @ApiOperation({ summary: 'Generate holidays from calendar + weekend + matrix' })
  @Permissions('TENANT_CREATE')
  async generateHolidays(
    @Body() dto: GenerateHolidaysDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.generateHolidays(
      MASTER_TEMPLATE,
      dto.academicYearId,
      {
        tenantId: MASTER_TEMPLATE,
        userId: user.sub,
        role: user.roles[0] ?? 'PLATFORM_ADMIN',
        correlationId: correlationIdHeader ?? randomUUID(),
      },
      false, // not preview — commit to DB
    );
  }

  @Post('holidays/preview')
  @ApiOperation({ summary: 'Preview generated holidays without saving' })
  @Permissions('TENANT_CREATE')
  async previewHolidays(
    @Body() dto: GenerateHolidaysDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.generateHolidays(
      MASTER_TEMPLATE,
      dto.academicYearId,
      {
        tenantId: MASTER_TEMPLATE,
        userId: user.sub,
        role: user.roles[0] ?? 'PLATFORM_ADMIN',
        correlationId: correlationIdHeader ?? randomUUID(),
      },
      true, // preview only — no DB writes
      dto.weekendDays,
      dto.matrixRules,
    );
  }

  @Get('holidays')
  @ApiOperation({ summary: 'List holiday entries for an academic year' })
  @Permissions('TENANT_CREATE')
  async listHolidays(
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.academicService.listHolidays(MASTER_TEMPLATE, academicYearId);
  }

  @Post('holidays')
  @ApiOperation({ summary: 'Create a manual holiday entry' })
  @Permissions('TENANT_CREATE')
  async createHolidayEntry(
    @Body() dto: CreateHolidayEntryDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.createHolidayEntry(dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('holidays/:id')
  @ApiOperation({ summary: 'Update a holiday entry' })
  @Permissions('TENANT_CREATE')
  async updateHolidayEntry(
    @Param('id') id: string,
    @Body() dto: UpdateHolidayEntryDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.updateHolidayEntry(id, dto, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('holidays/:id')
  @ApiOperation({ summary: 'Soft-delete a holiday entry' })
  @Permissions('TENANT_CREATE')
  async deleteHolidayEntry(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.deleteHolidayEntry(id, {
      tenantId: MASTER_TEMPLATE,
      userId: user.sub,
      role: user.roles[0] ?? 'PLATFORM_ADMIN',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }
}
