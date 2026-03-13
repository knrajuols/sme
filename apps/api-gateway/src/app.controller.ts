import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  NotImplementedException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { Throttle } from '@nestjs/throttler';

import { CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AppService } from './app.service';
import { AuthTokenRequestDto } from './dto/auth-token-request.dto';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';

@ApiTags('Gateway')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('platform/tenants')
  @ApiOperation({ summary: 'List all registered schools for platform admin' })
  @Permissions('TENANT_CREATE')
  async listAllSchools(
    @Headers('x-correlation-id') headerCorrelationId?: string,
    @CurrentUser() user?: JwtClaims,
  ): Promise<Array<Record<string, unknown>>> {
    if (!user) throw new ForbiddenException('Authenticated user context is required');
    if (!user.roles.includes('PLATFORM_ADMIN')) throw new ForbiddenException('Only platform admin can list schools');
    return this.appService.listAllSchools(user, headerCorrelationId || randomUUID());
  }

  @Patch('platform/tenants/:tenantId')
  @ApiOperation({ summary: 'Update a school record' })
  @Permissions('TENANT_CREATE')
  async updateSchool(
    @Param('tenantId') tenantId: string,
    @Body() dto: Record<string, unknown>,
    @Headers('x-correlation-id') headerCorrelationId?: string,
    @CurrentUser() user?: JwtClaims,
  ): Promise<{ tenantId: string; updated: boolean }> {
    if (!user) throw new ForbiddenException('Authenticated user context is required');
    if (!user.roles.includes('PLATFORM_ADMIN')) throw new ForbiddenException('Only platform admin can update schools');
    return this.appService.updateSchool(tenantId, dto, user, headerCorrelationId || randomUUID());
  }

  @Get('platform/tenants/pending')
  @ApiOperation({ summary: 'List pending school registrations for platform admin approval' })
  @Permissions('TENANT_CREATE')
  async listPendingSchools(
    @Headers('x-correlation-id') headerCorrelationId?: string,
    @CurrentUser() user?: JwtClaims,
  ): Promise<Array<{ tenantId: string; tenantCode: string; schoolName: string; status: string; createdAt: string }>> {
    if (!user) {
      throw new ForbiddenException('Authenticated user context is required');
    }

    if (!user.roles.includes('PLATFORM_ADMIN')) {
      throw new ForbiddenException('Only platform admin can view pending schools');
    }

    return this.appService.listPendingSchools(user, headerCorrelationId || randomUUID());
  }

  @Public()
  @Post('onboarding/schools/register')
  @ApiOperation({ summary: 'Public school self-registration' })
  async registerSchool(
    @Body() dto: CreatePlatformTenantDto,
    @Headers('x-correlation-id') headerCorrelationId?: string,
  ): Promise<{ tenantId: string; tenantCode: string }> {
    return this.appService.registerSchool(dto, headerCorrelationId || randomUUID());
  }

  @Post('platform/tenants/:tenantId/activate')
  @ApiOperation({ summary: 'Activate newly registered school and provision onboarding credentials' })
  @Permissions('TENANT_CREATE')
  async activateSchool(
    @Param('tenantId') tenantId: string,
    @Headers('x-correlation-id') headerCorrelationId?: string,
    @CurrentUser() user?: JwtClaims,
  ): Promise<{ tenantId: string; status: string; onboardingCredentials: Array<{ email: string; loginUrl: string }> }> {
    if (!user) {
      throw new ForbiddenException('Authenticated user context is required');
    }

    if (!user.roles.includes('PLATFORM_ADMIN')) {
      throw new ForbiddenException('Only platform admin can activate a school');
    }

    return this.appService.activateSchool(tenantId, user, headerCorrelationId || randomUUID());
  }

  @Public()
  @Post('iam/auth/token')
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Issue access token via IAM service — rate-limited to 10 req/min per IP (RISK-07)' })
  async issueToken(
    @Body() dto: AuthTokenRequestDto,
  ): Promise<{ accessToken: string; expiresIn: number; claims: JwtClaims }> {
    return this.appService.issueIamAccessToken(dto);
  }

  @Get('auth/me')
  @ApiOperation({ summary: 'Resolve current authenticated user claims' })
  me(@CurrentUser() user: JwtClaims): JwtClaims {
    return user;
  }

  @Get('school/profile')
  @ApiOperation({ summary: 'Get current school full profile for authenticated school users' })
  async schoolProfile(
    @CurrentUser() user: JwtClaims,
  ): Promise<Record<string, unknown> | null> {
    return this.appService.getCurrentSchoolProfile(user);
  }

  @Patch('school/profile')
  @ApiOperation({ summary: 'School admin updates their own school profile' })
  async updateSchoolProfile(
    @Body() dto: Record<string, unknown>,
    @Headers('x-correlation-id') headerCorrelationId?: string,
    @CurrentUser() user?: JwtClaims,
  ): Promise<{ tenantId: string; updated: boolean }> {
    if (!user) throw new ForbiddenException('Authenticated user context is required');
    if (!user.roles.includes('SCHOOL_ADMIN') && !user.roles.includes('PLATFORM_ADMIN')) {
      throw new ForbiddenException('Only school admins can update school profile');
    }
    if (user.roles.includes('PLATFORM_ADMIN')) {
      throw new ForbiddenException('Platform admin should use /platform/tenants/:id');
    }
    return this.appService.updateOwnSchoolProfile(user, dto, headerCorrelationId || randomUUID());
  }

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

  // ─── Module probe routes ─────────────────────────────────────────────────────
  // These stub routes give the ModuleGuard a registered handler to intercept.
  // When the corresponding attendance / fees / exam service is deployed, replace
  // the NotImplementedException body with a real proxy call.

  @Get('attendance/ping')
  @ApiOperation({ summary: 'Attendance module liveness probe (RISK-07 test target)' })
  @HttpCode(200)
  attendancePing(): { module: string; status: string } {
    throw new NotImplementedException({
      type: 'https://sme.example.com/errors/not-implemented',
      title: 'Not Implemented',
      status: 501,
      detail: 'Attendance service is not yet deployed. Module guard is active.',
    });
  }

  @Get('fees/ping')
  @ApiOperation({ summary: 'Fees module liveness probe' })
  @HttpCode(200)
  feesPing(): { module: string; status: string } {
    throw new NotImplementedException({
      type: 'https://sme.example.com/errors/not-implemented',
      title: 'Not Implemented',
      status: 501,
      detail: 'Fees service is not yet deployed. Module guard is active.',
    });
  }
}
