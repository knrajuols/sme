import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentTenant, CurrentUser, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';
import { EventActor } from '@sme/common';

import { AppService } from './app.service';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('Platform')
@Controller('platform/tenants')
export class PlatformController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered schools' })
  @Permissions('TENANT_CREATE')
  async listAllTenants(
    @CurrentUser() user?: JwtClaims,
  ) {
    if (!user) throw new ForbiddenException('Authenticated user context is required');
    if (!user.roles.includes('PLATFORM_ADMIN')) throw new ForbiddenException('Only platform admin can list all schools');
    return this.appService.listAllTenants();
  }

  @Patch(':tenantId')
  @ApiOperation({ summary: 'Update a school record' })
  @Permissions('TENANT_CREATE')
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user?: JwtClaims,
  ): Promise<{ tenantId: string; updated: boolean }> {
    if (!user) throw new ForbiddenException('Authenticated user context is required');
    if (!user.roles.includes('PLATFORM_ADMIN')) throw new ForbiddenException('Only platform admin can update schools');
    return this.appService.updateTenant(tenantId, dto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List pending school registrations' })
  @Permissions('TENANT_CREATE')
  async listPendingTenants(
    @CurrentUser() user?: JwtClaims,
  ): Promise<Array<{ tenantId: string; tenantCode: string; schoolName: string; status: string; createdAt: string }>> {
    if (!user) {
      throw new ForbiddenException('Authenticated user context is required');
    }

    if (!user.roles.includes('PLATFORM_ADMIN')) {
      throw new ForbiddenException('Only platform admin can view pending tenants');
    }

    return this.appService.listPendingTenants();
  }

  @Post()
  @ApiOperation({ summary: 'Create tenant and publish onboarding events' })
  @Permissions('TENANT_CREATE')
  async createTenant(
    @Body() dto: CreatePlatformTenantDto,
    @Headers('x-correlation-id') headerCorrelationId?: string,
    @CurrentUser() user?: JwtClaims,
    @CurrentTenant() tenantId?: string,
  ): Promise<{ tenantId: string; tenantCode: string }> {
    if (!user) {
      throw new ForbiddenException('Authenticated user context is required');
    }

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
    @CurrentUser() user?: JwtClaims,
  ): Promise<{ tenantId: string; status: string }> {
    if (!user) {
      throw new ForbiddenException('Authenticated user context is required');
    }

    if (!user.roles.includes('PLATFORM_ADMIN')) {
      throw new ForbiddenException('Only platform admin can activate tenant');
    }

    return this.appService.activateTenant(tenantId);
  }
}
