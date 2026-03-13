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

import { CurrentTenant, CurrentUser } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';

import { TimetableService } from './timetable.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';

@ApiTags('Timetable')
@Controller('timetable')
@UseGuards(RolesGuard)
@Roles('SCHOOL_ADMIN')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  // ── Matrix Aggregation (must come before /:id routes) ─────────────────────

  @Get('matrix')
  @ApiOperation({ summary: 'Get full timetable matrix for a class-section' })
  async getMatrix(
    @CurrentTenant() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
    @Query('sectionId') sectionId: string,
  ) {
    return this.timetableService.getMatrix(tenantId, academicYearId, classId, sectionId);
  }

  // ── TimeTableEntry — day-agnostic 2-D grid ────────────────────────────────

  @Get('entries')
  @ApiOperation({ summary: 'Get all timetable entries (periods + classes + cells) for a year' })
  async getEntries(
    @CurrentTenant() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.timetableService.getEntries(tenantId, academicYearId);
  }

  @Post('upsert')
  @ApiOperation({ summary: 'Create or update a day-agnostic timetable cell' })
  async upsertEntry(
    @Body() dto: {
      academicYearId: string;
      classId: string;
      sectionId: string;
      periodId: string;
      subjectId?: string | null;
      teacherId?: string | null;
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
  ): Promise<{ id: string }> {
    return this.timetableService.upsertEntry(dto, { tenantId, userId: user.sub });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a timetable entry (with conflict detection)' })
  async createEntry(
    @Body() dto: CreateTimetableDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') _correlationId?: string,
  ): Promise<{ id: string }> {
    return this.timetableService.createEntry(dto, {
      tenantId,
      userId: user.sub,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a timetable entry (with conflict detection)' })
  async updateEntry(
    @Param('id') id: string,
    @Body() dto: UpdateTimetableDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') _correlationId?: string,
  ): Promise<{ updated: boolean }> {
    return this.timetableService.updateEntry(id, dto, {
      tenantId,
      userId: user.sub,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a timetable entry' })
  async deleteEntry(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') _correlationId?: string,
  ): Promise<{ deleted: boolean }> {
    return this.timetableService.deleteEntry(id, {
      tenantId,
      userId: user.sub,
    });
  }
}
