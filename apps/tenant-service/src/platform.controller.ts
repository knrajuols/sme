import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentTenant, CurrentUser, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';
import { EventActor } from '@sme/common';

import { AppService } from './app.service';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';

@ApiTags('Platform')
@Controller('platform/tenants')
export class PlatformController {
  constructor(private readonly appService: AppService) {}

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
}
