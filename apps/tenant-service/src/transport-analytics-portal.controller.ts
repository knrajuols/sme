/**
 * transport-analytics-portal.controller.ts — Transport Fleet Analytics Controller
 * ──────────────────────────────────────────────────────────────────────────────
 * Prompt #288 — Exposes aggregated transport fleet utilization data for the
 * web-portal dashboard. Tenant-scoped via @CurrentTenant() JWT claim.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant, Permissions } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { TransportAnalyticsService } from './transport-analytics.service';

@ApiTags('Transport Analytics (Portal)')
@Controller('transport/analytics')
@UseGuards(RolesGuard)
@Roles('SCHOOL_ADMIN')
export class TransportAnalyticsPortalController {
  constructor(private readonly svc: TransportAnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Aggregated fleet utilization dashboard data (school)' })
  @Permissions('TEACHER_ASSIGN')
  async dashboard(@CurrentTenant() tenantId: string) {
    return this.svc.getDashboard(tenantId);
  }
}
