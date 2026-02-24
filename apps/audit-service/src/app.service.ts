import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import type { JwtClaims } from '@sme/auth';
import {
  AuditEventRequestedPayload,
  checkRabbitMqConnection,
  checkRedisPing,
  EventEnvelope,
} from '@sme/common';

import { CreateAuditEventDto } from './dto/create-audit-event.dto';
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
  ) {}

  live(): { service: string; status: string } {
    return { service: 'audit-service', status: 'ok' };
  }

  async health(): Promise<{ service: string; status: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { service: 'audit-service', status: 'up' };
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

  async create(dto: CreateAuditEventDto): Promise<{ persisted: boolean; event: CreateAuditEventDto }> {
    await this.prisma.$executeRaw`
      INSERT INTO "AuditEvent" ("id", "action", "actor", "payload", "createdAt")
      VALUES (${randomUUID()}, ${dto.action}, ${dto.actor}, ${JSON.stringify(dto.payload)}::jsonb, ${new Date()})
    `;

    return {
      persisted: true,
      event: dto,
    };
  }

  async handleAuditEventRequested(
    envelope: EventEnvelope<AuditEventRequestedPayload>,
  ): Promise<void> {
    const payload = {
      summary: envelope.payload.summary,
      metadata: envelope.payload.metadata ?? {},
      producer: envelope.producer,
      occurredAt: envelope.occurredAt,
    };

    await this.prisma.$executeRaw`
      INSERT INTO "AuditEvent" (
        "id",
        "eventType",
        "correlationId",
        "action",
        "actor",
        "actorType",
        "actorId",
        "actorRole",
        "entity",
        "entityId",
        "tenantId",
        "tenantCode",
        "payload",
        "createdAt"
      ) VALUES (
        ${randomUUID()},
        ${envelope.eventType},
        ${envelope.correlationId},
        ${envelope.payload.action},
        ${envelope.actor.actorId},
        ${envelope.actor.actorType},
        ${envelope.actor.actorId},
        ${envelope.actor.role},
        ${envelope.payload.entity},
        ${envelope.payload.entityId},
        ${envelope.tenantId},
        ${typeof envelope.payload.metadata?.tenantCode === 'string' ? envelope.payload.metadata.tenantCode : null},
        ${JSON.stringify(payload)}::jsonb,
        ${new Date()}
      )
    `;
  }

  async findByTenantId(
    tenantId: string,
    user: JwtClaims,
  ): Promise<Array<{ id: string; action: string; entity: string | null; correlationId: string | null; createdAt: Date }>> {
    if (!user.roles.includes('PLATFORM_ADMIN') && user.tenantId !== tenantId) {
      throw new ForbiddenException({
        message: 'Cross-tenant access is forbidden',
        code: 'TENANT_SCOPE_VIOLATION',
      });
    }

    const rows = await this.prisma.$queryRaw<Array<{ id: string; action: string; entity: string | null; correlationId: string | null; createdAt: Date }>>`
      SELECT "id", "action", "entity", "correlationId", "createdAt"
      FROM "AuditEvent"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "createdAt" ASC
    `;

    return rows;
  }
}
