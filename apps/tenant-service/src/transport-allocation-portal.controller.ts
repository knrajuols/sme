/**
 * transport-allocation-portal.controller.ts — Tenant-Scoped Transport Allocation Controller
 * ──────────────────────────────────────────────────────────────────────────────
 * Prompt #285 — Serves the web-portal (School Admin) with tenant-isolated
 * transport allocation data. Every query is strictly scoped by the tenantId
 * extracted from the authenticated user's JWT claim via @CurrentTenant().
 *
 * ZERO cross-tenant data bleed is allowed.
 */
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

import { CurrentTenant, CurrentUser, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { TransportAllocationService } from './transport-allocation.service';
import {
  CreateTransportAllocationDto,
  UpdateTransportAllocationDto,
} from './dto/transport-allocation.dto';

function buildCtx(tenantId: string, user: JwtClaims, cid?: string) {
  return {
    tenantId,
    userId: user.sub,
    role: user.roles[0] ?? 'SCHOOL_ADMIN',
    correlationId: cid ?? randomUUID(),
  };
}

@ApiTags('Transport Allocations (Portal)')
@Controller('transport/allocations')
@UseGuards(RolesGuard)
@Roles('SCHOOL_ADMIN')
export class TransportAllocationPortalController {
  constructor(private readonly svc: TransportAllocationService) {}

  // ── List all allocations for the school ───────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all student transport allocations for the school' })
  @Permissions('TEACHER_ASSIGN')
  async list(@CurrentTenant() tenantId: string) {
    return this.svc.listAllocations(tenantId);
  }

  // ── Students grid (all students with allocation status) ───────────────────

  @Get('students-grid')
  @ApiOperation({ summary: 'All active students with their transport allocation status (school)' })
  @Permissions('TEACHER_ASSIGN')
  async studentsGrid(@CurrentTenant() tenantId: string) {
    return this.svc.getStudentsGrid(tenantId);
  }

  // ── Lookup data (routes, trips, stops, academic years) ────────────────────

  @Get('lookup')
  @ApiOperation({ summary: 'Get routes/trips/stops/academic years for allocation form (school)' })
  @Permissions('TEACHER_ASSIGN')
  async lookup(@CurrentTenant() tenantId: string) {
    return this.svc.getLookupData(tenantId);
  }

  // ── Search students ───────────────────────────────────────────────────────

  @Get('students')
  @ApiOperation({ summary: 'Search active students for allocation (school)' })
  @Permissions('TEACHER_ASSIGN')
  async searchStudents(
    @CurrentTenant() tenantId: string,
    @Query('q') q: string,
  ) {
    return this.svc.searchStudents(tenantId, q ?? '');
  }

  // ── Create allocation ─────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Allocate a student to a transport route (school)' })
  @Permissions('TEACHER_ASSIGN')
  async create(
    @Body() dto: CreateTransportAllocationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') corr?: string,
  ) {
    return this.svc.createAllocation(dto, buildCtx(tenantId, user, corr));
  }

  // ── Update allocation ─────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update a student transport allocation (school)' })
  @Permissions('TEACHER_ASSIGN')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTransportAllocationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') corr?: string,
  ) {
    return this.svc.updateAllocation(id, dto, buildCtx(tenantId, user, corr));
  }

  // ── Revoke (soft-delete) ──────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a student transport allocation (school)' })
  @Permissions('TEACHER_ASSIGN')
  async revoke(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') corr?: string,
  ) {
    return this.svc.revokeAllocation(id, buildCtx(tenantId, user, corr));
  }
}
