import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant, Permissions } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { AdminSummary, DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(RolesGuard)
@Roles('SCHOOL_ADMIN')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get high-level KPI summary for the admin dashboard' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getAdminSummary(
    @CurrentTenant() tenantId: string,
  ): Promise<AdminSummary> {
    return this.dashboardService.getAdminSummary(tenantId);
  }
}
