import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import type { JwtClaims } from '@sme/auth';
import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  checkRabbitMqConnection,
  checkRedisPing,
  EventEnvelope,
  TenantCreatedPayload,
} from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';

import { UpsertConfigurationDto } from './dto/upsert-configuration.dto';
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
    return { service: 'config-service', status: 'ok' };
  }

  async health(): Promise<{ service: string; status: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { service: 'config-service', status: 'up' };
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

  async findByTenantId(tenantId: string): Promise<{ tenantId: string; config: Record<string, unknown> }> {
    const configRows = await this.prisma.$queryRaw<Array<{ configType: string; configKey: string; payload: unknown }>>`
      SELECT "configType", "configKey", "payload"
      FROM "ConfigMaster"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "configType" ASC, "configKey" ASC
    `;

    return {
      tenantId,
      config: {
        entries: configRows.map((row) => ({
          configType: row.configType,
          configKey: row.configKey,
          payload: row.payload,
        })),
      },
    };
  }

  async upsert(dto: UpsertConfigurationDto, user: JwtClaims): Promise<{ saved: boolean; payload: UpsertConfigurationDto }> {
    await this.prisma.$executeRaw`
      INSERT INTO "ConfigMaster" ("id", "tenantId", "configType", "configKey", "payload", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${user.tenantId}, 'CUSTOM', ${dto.tenantCode}, ${JSON.stringify(dto.payload)}::jsonb, ${new Date()}, ${new Date()})
      ON CONFLICT ("tenantId", "configType", "configKey") DO UPDATE SET
        "payload" = EXCLUDED."payload",
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    const auditPayload: AuditEventRequestedPayload = {
      action: 'CONFIG_UPDATE',
      entity: 'Configuration',
      entityId: user.tenantId,
      summary: 'Configuration updated',
      metadata: {
        key: dto.tenantCode,
      },
    };

    const auditEnvelope: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId: user.tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      producer: { service: 'config-service' },
      actor: {
        actorType: 'USER',
        actorId: user.sub,
        role: user.roles[0] ?? 'USER',
      },
      payload: auditPayload,
    };

    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, auditEnvelope);

    return {
      saved: true,
      payload: dto,
    };
  }

  async getModuleEntitlements(tenantId: string): Promise<Array<{ moduleKey: string; enabled: boolean }>> {
    const rows = await this.prisma.$queryRaw<Array<{ moduleKey: string; enabled: boolean }>>`
      SELECT "moduleKey", "enabled"
      FROM "ModuleEntitlement"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "moduleKey" ASC
    `;

    return rows.map((row) => ({
      moduleKey: row.moduleKey,
      enabled: row.enabled,
    }));
  }

  async handleTenantCreatedEvent(
    envelope: EventEnvelope<TenantCreatedPayload>,
  ): Promise<void> {
    const processed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ProcessedEvent"
      WHERE "eventId" = ${envelope.eventId}
      LIMIT 1
    `;

    if (processed.length > 0) {
      return;
    }

    const moduleDefaults: Array<{ moduleKey: string; enabled: boolean }> = [
      { moduleKey: 'attendance', enabled: true },
      { moduleKey: 'fees', enabled: true },
      { moduleKey: 'exam', enabled: true },
      { moduleKey: 'portal', enabled: true },
      { moduleKey: 'website', enabled: true },
      { moduleKey: 'library', enabled: false },
      { moduleKey: 'transport', enabled: false },
      { moduleKey: 'hostel', enabled: false },
    ];

    for (const item of moduleDefaults) {
      await this.prisma.$executeRaw`
        INSERT INTO "ModuleEntitlement" ("id", "tenantId", "moduleKey", "enabled", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${envelope.tenantId}, ${item.moduleKey}, ${item.enabled}, ${new Date()}, ${new Date()})
        ON CONFLICT ("tenantId", "moduleKey") DO UPDATE SET
          "enabled" = EXCLUDED."enabled",
          "updatedAt" = EXCLUDED."updatedAt"
      `;
    }

    const configDefaults: Array<{ configType: string; configKey: string; payload: Record<string, unknown> }> = [
      {
        configType: 'GRADING',
        configKey: 'default',
        payload: { scale: 'A-F', passMark: 40 },
      },
      {
        configType: 'ACADEMIC',
        configKey: 'default',
        payload: { termSystem: 'semester', sessions: 2 },
      },
      {
        configType: 'WORKFLOW',
        configKey: 'result_publish',
        payload: { approvalRequired: true },
      },
    ];

    for (const item of configDefaults) {
      await this.prisma.$executeRaw`
        INSERT INTO "ConfigMaster" ("id", "tenantId", "configType", "configKey", "payload", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${envelope.tenantId}, ${item.configType}, ${item.configKey}, ${JSON.stringify(item.payload)}::jsonb, ${new Date()}, ${new Date()})
        ON CONFLICT ("tenantId", "configType", "configKey") DO UPDATE SET
          "payload" = EXCLUDED."payload",
          "updatedAt" = EXCLUDED."updatedAt"
      `;
    }

    await this.prisma.$executeRaw`
      INSERT INTO "ProcessedEvent" ("id", "eventId", "eventType", "processedAt")
      VALUES (${randomUUID()}, ${envelope.eventId}, ${envelope.eventType}, ${new Date()})
    `;

    const auditPayload: AuditEventRequestedPayload = {
      action: 'SEED_DEFAULTS',
      entity: 'Configuration',
      entityId: envelope.tenantId,
      summary: 'Default entitlements and configuration seeded',
      metadata: {
        tenantCode: envelope.payload.tenantCode,
      },
    };

    const auditEnvelope: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId: envelope.tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: envelope.correlationId,
      producer: { service: 'config-service' },
      actor: envelope.actor,
      payload: auditPayload,
    };

    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, auditEnvelope);
  }
}
