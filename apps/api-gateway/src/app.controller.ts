import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AppService } from './app.service';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';

@ApiTags('Gateway')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('platform/tenants')
  @ApiOperation({ summary: 'Create tenant onboarding request' })
  @Permissions('TENANT_CREATE')
  async createPlatformTenant(
    @Body() dto: CreatePlatformTenantDto,
    @Headers('x-correlation-id') headerCorrelationId?: string,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @CurrentUser() user?: JwtClaims,
  ): Promise<{ tenantId: string; tenantCode: string }> {
    if (!user) {
      throw new ForbiddenException('Authenticated user context is required');
    }

    const correlationId = headerCorrelationId || randomUUID();
    const isPlatformAdmin = user.roles.includes('PLATFORM_ADMIN');
    const requestedTenantId = tenantIdHeader?.trim();
    const resolvedTenantId = isPlatformAdmin && requestedTenantId ? requestedTenantId : user.tenantId;

    if (!isPlatformAdmin && requestedTenantId && requestedTenantId !== user.tenantId) {
      await this.appService.logImpersonationAttempt({
        actor: user,
        requestedTenantId,
        resolvedTenantId: user.tenantId,
        correlationId,
        allowed: false,
      });
    }

    if (isPlatformAdmin && requestedTenantId) {
      await this.appService.logImpersonationAttempt({
        actor: user,
        requestedTenantId,
        resolvedTenantId,
        correlationId,
        allowed: true,
      });
    }

    return this.appService.createPlatformTenant(dto, {
      correlationId,
      actorId: user.sub,
      actorRole: user.roles[0] ?? 'SYSTEM_ADMIN',
      tenantId: resolvedTenantId,
      accessToken: this.appService.issueServiceToken(user, resolvedTenantId),
    });
  }

  @Public()
  @Get('health/live')
  @ApiOperation({ summary: 'API Gateway liveness check' })
  live(): { status: string; service: string } {
    return this.appService.live();
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'API Gateway readiness check' })
  async ready(): Promise<{ status: string; service: string }> {
    const readiness = await this.appService.readiness();

    if (!readiness.ok) {
      throw new ServiceUnavailableException({
        message: 'Service readiness check failed',
        code: 'HEALTH_READY_FAILED',
        details: readiness.details,
      });
    }

    return this.appService.live();
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'API Gateway health check' })
  health(): { service: string; redisUrl: string; rabbitmqUrl: string; status: string } {
    return this.appService.health();
  }

  @Get('internal/health')
  @ApiOperation({ summary: 'Gateway internal health endpoint (requires internal secret + JWT)' })
  internalHealth(): { status: string; service: string } {
    return this.appService.live();
  }
}
