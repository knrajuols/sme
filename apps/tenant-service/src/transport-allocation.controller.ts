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
import { TransportAllocationService } from './transport-allocation.service';
import {
  CreateTransportAllocationDto,
  UpdateTransportAllocationDto,
} from './dto/transport-allocation.dto';

const MASTER_TEMPLATE = 'MASTER_TEMPLATE';

function ctx(user: JwtClaims, correlationIdHeader?: string) {
  return {
    tenantId: MASTER_TEMPLATE,
    userId: user.sub,
    role: user.roles[0] ?? 'PLATFORM_ADMIN',
    correlationId: correlationIdHeader ?? randomUUID(),
  };
}

@ApiTags('Transport Allocations')
@Controller('web-admin/transport-allocations')
@UseGuards(RolesGuard)
@Roles('PLATFORM_ADMIN')
export class TransportAllocationController {
  constructor(private readonly svc: TransportAllocationService) {}

  // ── List all allocations ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all student transport allocations' })
  @Permissions('TENANT_CREATE')
  async list() {
    return this.svc.listAllocations(MASTER_TEMPLATE);
  }

  // ── Lookup data (routes, trips, stops, academic years) ────────────────────

  @Get('lookup')
  @ApiOperation({ summary: 'Get routes/trips/stops/academic years for allocation form' })
  @Permissions('TENANT_CREATE')
  async lookup() {
    return this.svc.getLookupData(MASTER_TEMPLATE);
  }

  // ── Search students ───────────────────────────────────────────────────────

  @Get('students')
  @ApiOperation({ summary: 'Search active students for allocation' })
  @Permissions('TENANT_CREATE')
  async searchStudents(@Query('q') q: string) {
    return this.svc.searchStudents(MASTER_TEMPLATE, q ?? '');
  }

  // ── Create allocation ─────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Allocate a student to a transport route' })
  @Permissions('TENANT_CREATE')
  async create(
    @Body() dto: CreateTransportAllocationDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') corr?: string,
  ) {
    return this.svc.createAllocation(dto, ctx(user, corr));
  }

  // ── Update allocation ─────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update a student transport allocation' })
  @Permissions('TENANT_CREATE')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTransportAllocationDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') corr?: string,
  ) {
    return this.svc.updateAllocation(id, dto, ctx(user, corr));
  }

  // ── Revoke (soft-delete) ──────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a student transport allocation' })
  @Permissions('TENANT_CREATE')
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') corr?: string,
  ) {
    return this.svc.revokeAllocation(id, ctx(user, corr));
  }
}
