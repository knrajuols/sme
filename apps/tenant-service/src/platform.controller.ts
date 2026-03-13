import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentTenant, CurrentUser, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';
import { EventActor } from '@sme/common';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { AppService } from './app.service';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('Platform')
@Controller('platform/tenants')
@UseGuards(RolesGuard)
@Roles('PLATFORM_ADMIN')
export class PlatformController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered schools' })
  @Permissions('TENANT_CREATE')
  async listAllTenants() {
    return this.appService.listAllTenants();
  }

  @Patch(':tenantId')
  @ApiOperation({ summary: 'Update a school record' })
  @Permissions('TENANT_CREATE')
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<{ tenantId: string; updated: boolean }> {
    return this.appService.updateTenant(tenantId, dto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List pending school registrations' })
  @Permissions('TENANT_CREATE')
  async listPendingTenants(): Promise<Array<{ tenantId: string; tenantCode: string; schoolName: string; status: string; createdAt: string }>> {
    return this.appService.listPendingTenants();
  }

  @Post()
  @ApiOperation({ summary: 'Create tenant and publish onboarding events' })
  @Permissions('TENANT_CREATE')
  async createTenant(
    @Body() dto: CreatePlatformTenantDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') headerCorrelationId?: string,
    @CurrentTenant() tenantId?: string,
  ): Promise<{ tenantId: string; tenantCode: string }> {
    const correlationId = headerCorrelationId || randomUUID();
    const actor: EventActor = {
      actorType: 'USER',
      actorId: user.sub,
      role: user.roles[0] ?? 'SYSTEM_ADMIN',
    };

    return this.appService.createPlatformTenant(dto, correlationId, actor, tenantId ?? user.tenantId);
  }

  @Post(':tenantId/activate')
  @ApiOperation({ summary: 'Activate tenant after platform admin approval' })
  @Permissions('TENANT_CREATE')
  async activateTenant(
    @Param('tenantId') tenantId: string,
  ): Promise<{ tenantId: string; status: string }> {
    return this.appService.activateTenant(tenantId);
  }
}
