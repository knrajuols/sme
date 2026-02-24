import { Injectable } from '@nestjs/common';
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

  async createPlatformTenant(
    dto: CreatePlatformTenantDto,
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<{ tenantId: string; tenantCode: string }> {
    return this.tenantClientService.createPlatformTenant(dto, context);
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
