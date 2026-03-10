import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AppService } from './app.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('Tenants')
@Controller('tenants')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Tenant service health check with DB ping' })
  async health(): Promise<{ service: string; status: string }> {
    return this.appService.health();
  }

  @Get('/internal/health')
  @ApiOperation({ summary: 'Tenant internal health endpoint (requires internal secret + JWT)' })
  internalHealth(): { service: string; status: string } {
    return this.appService.live();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get tenant by code' })
  @Permissions('TENANT_CREATE')
  async getTenantByCode(@Param('code') code: string): Promise<{ code: string; status: string }> {
    return this.appService.getTenantByCode(code);
  }

  @Public()
  @Get('status/:tenantId')
  @ApiOperation({ summary: 'Get tenant status by tenant id (public read for auth gating)' })
  async getTenantStatusById(@Param('tenantId') tenantId: string): Promise<{ tenantId: string; status: string }> {
    return this.appService.getTenantStatusById(tenantId);
  }

  @Public()
  @Get('profile/:tenantId')
  @ApiOperation({ summary: 'Get tenant profile by tenant id' })
  async getTenantProfileById(
    @Param('tenantId') tenantId: string,
  ): Promise<{ tenantId: string; tenantCode: string; schoolName: string; status: string }> {
    return this.appService.getTenantProfileById(tenantId);
  }

  @Public()
  @Get('full-profile/:tenantId')
  @ApiOperation({ summary: 'Get full tenant profile (all fields) by tenant id' })
  async getTenantFullProfileById(
    @Param('tenantId') tenantId: string,
  ) {
    return this.appService.getTenantFullProfileById(tenantId);
  }

  @Patch('own-profile/:tenantId')
  @ApiOperation({ summary: 'School admin updates their own school profile (restricted fields only)' })
  async updateOwnProfile(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user?: JwtClaims,
  ): Promise<{ tenantId: string; updated: boolean }> {
    // Only SCHOOL_ADMIN (own tenant) or PLATFORM_ADMIN may call this endpoint.
    // TenantScopeGuard already enforces tenantId isolation; this adds role defence-in-depth.
    if (!user) throw new ForbiddenException('[ERR-TEN-PROF-4031] Authenticated context required');
    const isSchoolAdmin = user.roles.includes('SCHOOL_ADMIN');
    const isPlatformAdmin = user.roles.includes('PLATFORM_ADMIN');
    if (!isSchoolAdmin && !isPlatformAdmin) {
      throw new ForbiddenException('[ERR-TEN-PROF-4032] Insufficient role to update school profile');
    }
    return this.appService.updateOwnTenantProfile(tenantId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create tenant' })
  @Permissions('TENANT_CREATE')
  async createTenant(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: JwtClaims,
  ): Promise<{ created: boolean; tenant: CreateTenantDto }> {
    return this.appService.createTenant(dto, user);
  }
}
