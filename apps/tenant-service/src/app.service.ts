import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import type { JwtClaims } from '@sme/auth';
import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  checkRabbitMqConnection,
  checkRedisPing,
  EventActor,
  EventEnvelope,
  TENANT_CREATED_ROUTING_KEY,
  TenantCreatedPayload,
} from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';

import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { PrismaService } from './prisma/prisma.service';

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
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly publisher: MessagePublisherService,
  ) {}

  live(): { service: string; status: string } {
    return { service: 'tenant-service', status: 'ok' };
  }

  async health(): Promise<{ service: string; status: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { service: 'tenant-service', status: 'up' };
  }

  async readiness(): Promise<ReadinessResult> {
    const details: Record<string, ReadinessDetail> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      details.postgres = { status: 'ok' };
    } catch {
      details.postgres = { status: 'fail', code: 'POSTGRES_UNREACHABLE' };
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      const redisCheck = await checkRedisPing(redisUrl, 2000);
      details.redis = redisCheck.ok
        ? { status: 'ok' }
        : { status: 'fail', code: redisCheck.code ?? 'REDIS_UNREACHABLE' };
    }

    const rabbitMqUrl = this.configService.get<string>('RABBITMQ_URL');
    if (rabbitMqUrl) {
      const rabbitCheck = await checkRabbitMqConnection(rabbitMqUrl, 2000);
      details.rabbitmq = rabbitCheck.ok
        ? { status: 'ok' }
        : {
            status: 'fail',
            code: rabbitCheck.code ?? 'RABBITMQ_UNREACHABLE',
          };
    }

    const ok = Object.values(details).every((value) => value.status === 'ok');
    return { ok, details };
  }

  async getTenantByCode(code: string): Promise<{ code: string; status: string }> {
    return { code, status: 'available' };
  }

  async createTenant(dto: CreateTenantDto, user: JwtClaims): Promise<{ created: boolean; tenant: CreateTenantDto }> {
    if (!user.roles.includes('PLATFORM_ADMIN') && user.tenantId !== dto.code) {
      throw new ForbiddenException({
        message: 'Cross-tenant access is forbidden',
        code: 'TENANT_SCOPE_VIOLATION',
      });
    }

    return {
      created: true,
      tenant: dto,
    };
  }

  async createPlatformTenant(
    dto: CreatePlatformTenantDto,
    correlationId: string,
    actor: EventActor,
    _tenantIdHint: string,
  ): Promise<{ tenantId: string; tenantCode: string }> {
    const tenantId = randomUUID();
    const now = new Date();

    await this.prisma.$executeRaw`
      INSERT INTO "Tenant" ("id", "code", "name", "status", "createdAt", "updatedAt")
      VALUES (${tenantId}, ${dto.tenantCode}, ${dto.schoolName}, ${dto.status ?? 'active'}, ${now}, ${now})
    `;

    const payload: TenantCreatedPayload = {
      tenantId,
      tenantCode: dto.tenantCode,
      schoolName: dto.schoolName,
      status: dto.status ?? 'active',
      primaryContactName: dto.primaryContactName,
      primaryContactEmail: dto.primaryContactEmail,
      primaryContactPhone: dto.primaryContactPhone,
      ...(dto.planId ? { planId: dto.planId } : {}),
    };

    if (dto.adminUserId) {
      await this.prisma.$executeRaw`
        INSERT INTO "TenantAdmin" ("id", "tenantId", "userId", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${tenantId}, ${dto.adminUserId}, ${now}, ${now})
      `;
    }

    const tenantCreatedEvent: EventEnvelope<TenantCreatedPayload> = {
      eventId: randomUUID(),
      eventType: TENANT_CREATED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId,
      producer: { service: 'tenant-service' },
      actor,
      payload,
    };

    await this.publisher.publish(TENANT_CREATED_ROUTING_KEY, tenantCreatedEvent);

    const auditPayload: AuditEventRequestedPayload = {
      action: 'CREATE',
      entity: 'Tenant',
      entityId: tenantId,
      summary: 'Tenant created',
      metadata: {
        tenantCode: dto.tenantCode,
        schoolName: dto.schoolName,
      },
    };

    const auditEvent: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId,
      producer: { service: 'tenant-service' },
      actor,
      payload: auditPayload,
    };

    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, auditEvent);

    return {
      tenantId,
      tenantCode: dto.tenantCode,
    };
  }
}
