/**
 * transport-portal.controller.ts — Tenant-Scoped Transport Controller
 * ──────────────────────────────────────────────────────────────────────────────
 * Serves the web-portal (School Admin) with tenant-isolated transport data:
 *   - GET  /transport/routes          → list routes for the school
 *   - GET  /transport/vehicles        → list vehicles
 *   - GET  /transport/stops           → list stops
 *   - POST /transport/clone-from-master → clone master fleet & routes
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentTenant, CurrentUser, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { TransportService } from './transport.service';

function buildCtx(tenantId: string, user: JwtClaims, cid?: string) {
  return {
    tenantId,
    userId: user.sub,
    role: user.roles[0] ?? 'USER',
    correlationId: cid ?? randomUUID(),
  };
}

@ApiTags('Transport (Portal)')
@Controller('transport')
@UseGuards(RolesGuard)
@Roles('SCHOOL_ADMIN')
export class TransportPortalController {
  constructor(private readonly transportService: TransportService) {}

  @Get('routes')
  @ApiOperation({ summary: 'List all routes with trips and stops for the school' })
  @Permissions('TEACHER_ASSIGN')
  async listRoutes(@CurrentTenant() tenantId: string) {
    return this.transportService.listRoutes(tenantId);
  }

  @Get('vehicles')
  @ApiOperation({ summary: 'List all vehicles for the school' })
  @Permissions('TEACHER_ASSIGN')
  async listVehicles(@CurrentTenant() tenantId: string) {
    return this.transportService.listVehicles(tenantId);
  }

  @Get('stops')
  @ApiOperation({ summary: 'List all stops for the school' })
  @Permissions('TEACHER_ASSIGN')
  async listStops(@CurrentTenant() tenantId: string) {
    return this.transportService.listStops(tenantId);
  }

  @Post('clone-from-master')
  @ApiOperation({ summary: 'Clone master fleet, stops, routes & schedules from MASTER_TEMPLATE' })
  @Permissions('TEACHER_ASSIGN')
  async cloneFromMaster(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ) {
    return this.transportService.cloneTransportFromMaster(buildCtx(tenantId, user, cid));
  }
}
