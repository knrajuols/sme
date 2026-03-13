import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString } from 'class-validator';

import { CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AppService } from './app.service';
import { UpsertConfigurationDto } from './dto/upsert-configuration.dto';

class RollbackConfigDto {
  @ApiProperty({ example: 2 })
  @IsNumber()
  targetVersion!: number;
}

class ToggleModuleDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;
}

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
  @ApiOperation({ summary: 'Config internal health endpoint (requires JWT)' })
  internalHealth(): { service: string; status: string } {
    return this.appService.live();
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get active configuration by tenant ID' })
  @Permissions('CONFIG_UPDATE')
  async findByTenantId(@Param('tenantId') tenantId: string): Promise<{ tenantId: string; config: Record<string, unknown> }> {
    return this.appService.findByTenantId(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create or version-bump configuration (RISK-05 fix)' })
  @Permissions('CONFIG_UPDATE')
  async upsert(
    @Body() dto: UpsertConfigurationDto,
    @CurrentUser() user: JwtClaims,
  ): Promise<{ saved: boolean; version: number; payload: UpsertConfigurationDto }> {
    return this.appService.upsert(dto, user);
  }

  @Post(':tenantId/rollback')
  @ApiOperation({ summary: 'Rollback config to a previous version (RISK-05 fix)' })
  @Permissions('CONFIG_UPDATE')
  async rollbackConfig(
    @Param('tenantId') tenantId: string,
    @Query('configType') configType: string,
    @Query('configKey')  configKey: string,
    @Body() dto: RollbackConfigDto,
    @CurrentUser() user: JwtClaims,
  ): Promise<{ rolledBack: boolean; version: number }> {
    return this.appService.rollbackConfig(tenantId, configType, configKey, dto.targetVersion, user);
  }

  @Get(':tenantId/modules')
  @ApiOperation({ summary: 'Get module entitlements by tenant ID' })
  @Permissions('MODULE_ENABLE')
  async findModulesByTenantId(
    @Param('tenantId') tenantId: string,
  ): Promise<{ tenantId: string; modules: Awaited<ReturnType<AppService['getModuleEntitlements']>> }> {
    const modules = await this.appService.getModuleEntitlements(tenantId);
    return { tenantId, modules };
  }

  @Put(':tenantId/modules/:moduleKey')
  @ApiOperation({ summary: 'Enable or disable a module for a tenant (RISK-07 fix)' })
  @Permissions('MODULE_ENABLE')
  async toggleModule(
    @Param('tenantId') tenantId: string,
    @Param('moduleKey') moduleKey: string,
    @Body() dto: ToggleModuleDto,
    @CurrentUser() user: JwtClaims,
  ): Promise<{ moduleKey: string; enabled: boolean }> {
    return this.appService.toggleModule(tenantId, moduleKey, dto.enabled, user);
  }
}

