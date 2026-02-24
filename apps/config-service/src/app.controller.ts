import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AppService } from './app.service';
import { UpsertConfigurationDto } from './dto/upsert-configuration.dto';

@ApiTags('Configurations')
@Controller('configurations')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Config service health check with DB ping' })
  async health(): Promise<{ service: string; status: string }> {
    return this.appService.health();
  }

  @Get('/internal/health')
  @ApiOperation({ summary: 'Config internal health endpoint (requires internal secret + JWT)' })
  internalHealth(): { service: string; status: string } {
    return this.appService.live();
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get configuration by tenant ID' })
  @Permissions('CONFIG_UPDATE')
  async findByTenantId(@Param('tenantId') tenantId: string): Promise<{ tenantId: string; config: Record<string, unknown> }> {
    return this.appService.findByTenantId(tenantId);
  }

  @Get(':tenantId/modules')
  @ApiOperation({ summary: 'Get module entitlements by tenant ID' })
  @Permissions('MODULE_ENABLE')
  async findModulesByTenantId(
    @Param('tenantId') tenantId: string,
  ): Promise<{ tenantId: string; modules: Array<{ moduleKey: string; enabled: boolean }> }> {
    const modules = await this.appService.getModuleEntitlements(tenantId);
    return { tenantId, modules };
  }

  @Post()
  @ApiOperation({ summary: 'Create or update configuration' })
  @Permissions('CONFIG_UPDATE')
  async upsert(
    @Body() dto: UpsertConfigurationDto,
    @CurrentUser() user: JwtClaims,
  ): Promise<{ saved: boolean; payload: UpsertConfigurationDto }> {
    return this.appService.upsert(dto, user);
  }
}
