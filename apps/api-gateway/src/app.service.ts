import { BadGatewayException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import type { JwtClaims } from '@sme/auth';
import { JwtTokenService } from '@sme/auth';
import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  checkHttpOk,
  checkRedisPing,
  EventEnvelope,
} from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';
import { TenantClientService } from '@sme/tenant-client';

import { AuthTokenRequestDto } from './dto/auth-token-request.dto';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';

interface ReadinessDetail {
  status: 'ok' | 'fail';
  code?: string;
}

interface ReadinessResult {
  ok: boolean;
  details: Record<string, ReadinessDetail>;
}

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly tenantClientService: TenantClientService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly publisher: MessagePublisherService,
  ) {}

  live(): { service: string; status: string } {
    return { service: 'api-gateway', status: 'ok' };
  }

  health(): { service: string; redisUrl: string; rabbitmqUrl: string; status: string } {
    return {
      service: 'api-gateway',
      status: 'up',
      redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
      rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    };
  }

  async issueIamAccessToken(
    dto: AuthTokenRequestDto,
  ): Promise<{ accessToken: string; expiresIn: number; claims: JwtClaims }> {
    const iamBaseUrl = this.configService.get<string>('IAM_SERVICE_URL') ?? 'http://localhost:3001';
    const targetUrl = `${iamBaseUrl.replace(/\/$/, '')}/iam/auth/token`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 5000);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(dto),
        signal: abortController.signal,
      });

      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        data?: { accessToken?: string; expiresIn?: number; claims?: JwtClaims };
        accessToken?: string;
        expiresIn?: number;
        claims?: JwtClaims;
      };

      if (!response.ok) {
        throw new HttpException(
          body?.message ?? 'Failed to issue access token',
          response.status,
        );
      }

      const accessToken = body?.data?.accessToken ?? body?.accessToken;
      const expiresIn = body?.data?.expiresIn ?? body?.expiresIn;
      const claims = body?.data?.claims ?? body?.claims;

      if (!accessToken || typeof expiresIn !== 'number' || !claims) {
        throw new BadGatewayException('IAM token response was incomplete');
      }

      return { accessToken, expiresIn, claims };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadGatewayException('Unable to reach IAM service for token issuance');
    } finally {
      clearTimeout(timeout);
    }
  }

  async createPlatformTenant(
    dto: CreatePlatformTenantDto,
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<{ tenantId: string; tenantCode: string }> {
    return this.tenantClientService.createPlatformTenant(dto, context);
  }

  async listAllSchools(
    actor: JwtClaims,
    correlationId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const serviceToken = this.issueServiceToken(actor, 'platform');
    return this.tenantClientService.listAllTenants({
      correlationId,
      actorId: actor.sub,
      actorRole: actor.roles[0] ?? 'PLATFORM_ADMIN',
      tenantId: 'platform',
      accessToken: serviceToken,
    });
  }

  async updateSchool(
    tenantId: string,
    dto: Record<string, unknown>,
    actor: JwtClaims,
    correlationId: string,
  ): Promise<{ tenantId: string; updated: boolean }> {
    const serviceToken = this.issueServiceToken(actor, 'platform');
    return this.tenantClientService.updateTenant(tenantId, dto, {
      correlationId,
      actorId: actor.sub,
      actorRole: actor.roles[0] ?? 'PLATFORM_ADMIN',
      tenantId: 'platform',
      accessToken: serviceToken,
    });
  }

  async listPendingSchools(
    actor: JwtClaims,
    correlationId: string,
  ): Promise<Array<{ tenantId: string; tenantCode: string; schoolName: string; status: string; createdAt: string }>> {
    const serviceToken = this.issueServiceToken(actor, 'platform');
    return this.tenantClientService.listPendingTenants({
      correlationId,
      actorId: actor.sub,
      actorRole: actor.roles[0] ?? 'PLATFORM_ADMIN',
      tenantId: 'platform',
      accessToken: serviceToken,
    });
  }

  async getCurrentSchoolProfile(
    actor: JwtClaims,
  ): Promise<Record<string, unknown> | null> {
    if (actor.roles.includes('PLATFORM_ADMIN')) {
      return null;
    }

    return this.tenantClientService.getFullTenantProfile(actor.tenantId);
  }

  async updateOwnSchoolProfile(
    actor: JwtClaims,
    dto: Record<string, unknown>,
    correlationId: string,
  ): Promise<{ tenantId: string; updated: boolean }> {
    // Strip fields school admin cannot change
    const { schoolName: _n, udiseCode: _u, schoolStatus: _s, tenantCode: _c, ...allowed } = dto;
    const serviceToken = this.issueServiceToken(actor, actor.tenantId);
    return this.tenantClientService.updateOwnTenantProfile(actor.tenantId, allowed, {
      correlationId,
      actorId: actor.sub,
      actorRole: actor.roles[0] ?? 'SCHOOL_ADMIN',
      tenantId: actor.tenantId,
      accessToken: serviceToken,
    });
  }

  async registerSchool(
    dto: CreatePlatformTenantDto,
    correlationId: string,
  ): Promise<{ tenantId: string; tenantCode: string }> {
    const sessionId = randomUUID();
    const serviceToken = this.jwtTokenService.issueToken({
      sub: 'public-school-onboarding',
      tenantId: 'platform',
      roles: ['PLATFORM_ADMIN'],
      permissions: ['TENANT_CREATE'],
      sessionId,
      expiresInSeconds: 300,
    });

    return this.createPlatformTenant(
      {
        ...dto,
        status: 'pending_activation',
      },
      {
      correlationId,
      actorId: 'public-school-onboarding',
      actorRole: 'PLATFORM_ADMIN',
      tenantId: 'platform',
      accessToken: serviceToken,
      },
    );
  }

  async activateSchool(
    tenantId: string,
    actor: JwtClaims,
    correlationId: string,
  ): Promise<{ tenantId: string; status: string; onboardingCredentials: Array<{ email: string; loginUrl: string }> }> {
    const serviceToken = this.issueServiceToken(actor, 'platform');
    const activationResult = await this.tenantClientService.activateTenant(tenantId, {
      correlationId,
      actorId: actor.sub,
      actorRole: actor.roles[0] ?? 'PLATFORM_ADMIN',
      tenantId: 'platform',
      accessToken: serviceToken,
    });

    const iamBaseUrl = this.configService.get<string>('IAM_SERVICE_URL') ?? 'http://localhost:3001';
    const targetUrl = `${iamBaseUrl.replace(/\/$/, '')}/iam/onboarding/tenants/${tenantId}/activate`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'x-correlation-id': correlationId,
      },
    });

    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      data?: { tenantId?: string; activatedUsers?: Array<{ email: string }> };
      tenantId?: string;
      activatedUsers?: Array<{ email: string }>;
    };

    if (!response.ok) {
      throw new HttpException(body?.message ?? 'Failed to provision onboarding credentials', response.status);
    }

    const activatedUsers = body?.data?.activatedUsers ?? body?.activatedUsers ?? [];
    const webAdminUrl = this.configService.get<string>('WEB_ADMIN_URL') ?? 'http://localhost:3101/login';

    return {
      tenantId,
      status: activationResult.status,
      onboardingCredentials: activatedUsers.map((item) => ({
        email: item.email,
        loginUrl: webAdminUrl,
      })),
    };
  }

  issueServiceToken(user: JwtClaims, tenantId: string): string {
    return this.jwtTokenService.issueToken({
      sub: user.sub,
      tenantId,
      roles: user.roles,
      permissions: user.permissions ?? [],
      sessionId: user.sessionId,
      expiresInSeconds: Math.max(60, user.exp - user.iat),
    });
  }

  async logImpersonationAttempt(input: {
    actor: JwtClaims;
    requestedTenantId: string;
    resolvedTenantId: string;
    correlationId: string;
    allowed: boolean;
  }): Promise<void> {
    const payload: AuditEventRequestedPayload = {
      action: input.allowed ? 'IMPERSONATION_ALLOWED' : 'IMPERSONATION_DENIED',
      entity: 'GatewayImpersonation',
      entityId: input.requestedTenantId,
      summary: input.allowed
        ? 'Platform admin impersonation accepted'
        : 'Impersonation attempt denied for non-platform user',
      metadata: {
        actorUserId: input.actor.sub,
        actorRoles: input.actor.roles,
        requestedTenantId: input.requestedTenantId,
        resolvedTenantId: input.resolvedTenantId,
      },
    };

    const envelope: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId: input.resolvedTenantId,
      occurredAt: new Date().toISOString(),
      correlationId: input.correlationId,
      producer: { service: 'api-gateway' },
      actor: {
        actorType: 'USER',
        actorId: input.actor.sub,
        role: input.actor.roles[0] ?? 'USER',
      },
      payload,
    };

    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, envelope);
  }

  async readiness(): Promise<ReadinessResult> {
    const details: Record<string, ReadinessDetail> = {};

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      const redisCheck = await checkRedisPing(redisUrl, 2000);
      details.redis = redisCheck.ok
        ? { status: 'ok' }
        : { status: 'fail', code: redisCheck.code ?? 'REDIS_UNREACHABLE' };
    }

    const downstreamTargets = [
      {
        key: 'iam',
        baseUrl: this.configService.get<string>('IAM_SERVICE_URL'),
      },
      {
        key: 'tenant',
        baseUrl: this.configService.get<string>('TENANT_SERVICE_URL'),
      },
      {
        key: 'config',
        baseUrl: this.configService.get<string>('CONFIG_SERVICE_URL'),
      },
      {
        key: 'audit',
        baseUrl: this.configService.get<string>('AUDIT_SERVICE_URL'),
      },
      {
        key: 'portal',
        baseUrl: this.configService.get<string>('PORTAL_SERVICE_URL'),
      },
    ];

    for (const target of downstreamTargets) {
      if (!target.baseUrl) {
        details[target.key] = { status: 'fail', code: 'MISSING_SERVICE_URL' };
        continue;
      }

      const url = `${target.baseUrl.replace(/\/$/, '')}/health/live`;
      const healthCheck = await checkHttpOk(url, 2000);
      details[target.key] = healthCheck.ok
        ? { status: 'ok' }
        : {
            status: 'fail',
            code: healthCheck.code ?? 'DOWNSTREAM_UNREACHABLE',
          };
    }

    const ok = Object.values(details).every((value) => value.status === 'ok');
    return { ok, details };
  }
}
