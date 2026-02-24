import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AppService } from './app.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

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
