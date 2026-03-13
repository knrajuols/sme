import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import type { JwtClaims } from '@sme/auth';
import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  checkRabbitMqConnection,
  checkRedisPing,
  EventEnvelope,
  MODULE_DISABLED_ROUTING_KEY,
  MODULE_ENABLED_ROUTING_KEY,
  ModuleTogglePayload,
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

interface ModuleEntitlementRow {
  moduleKey: string;
  enabled: boolean;
  enabledBy: string | null;
  disabledBy: string | null;
  enabledAt: Date | null;
  disabledAt: Date | null;
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

  // â”€â”€â”€ Config read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async findByTenantId(tenantId: string): Promise<{ tenantId: string; config: Record<string, unknown> }> {
    // RISK-05 fix: only return isActive=true rows; query on tenantId (UUID), not tenantCode.
    const configRows = await this.prisma.$queryRaw<Array<{ configType: string; configKey: string; payload: unknown; version: number }>>`
      SELECT "configType", "configKey", "payload", "version"
      FROM "ConfigMaster"
      WHERE "tenantId" = ${tenantId}
        AND "isActive"  = true
        AND "softDelete" = false
      ORDER BY "configType" ASC, "configKey" ASC
    `;

    return {
      tenantId,
      config: {
        entries: configRows.map((row) => ({
          configType: row.configType,
          configKey: row.configKey,
          version: row.version,
          payload: row.payload,
        })),
      },
    };
  }

  // â”€â”€â”€ Config write (versioned) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async upsert(dto: UpsertConfigurationDto, user: JwtClaims): Promise<{ saved: boolean; version: number; payload: UpsertConfigurationDto }> {
    // RISK-05 fix: version bump strategy â€” deactivate current, insert new version.
    const current = await this.prisma.$queryRaw<Array<{ id: string; version: number; payload: unknown }>>`
      SELECT "id", "version", "payload"
      FROM "ConfigMaster"
      WHERE "tenantId"   = ${user.tenantId}
        AND "configType" = ${dto.configType}
        AND "configKey"  = ${dto.configKey}
        AND "isActive"   = true
        AND "softDelete" = false
      LIMIT 1
    `;

    const currentRecord = current[0];
    const nextVersion = (currentRecord?.version ?? 0) + 1;

    if (currentRecord) {
      await this.prisma.$executeRaw`
        UPDATE "ConfigMaster"
        SET "isActive"  = false, "updatedAt" = ${new Date()}, "updatedBy" = ${user.sub}
        WHERE "id" = ${currentRecord.id}
      `;
    }

    await this.prisma.$executeRaw`
      INSERT INTO "ConfigMaster" (
        "id", "tenantId", "configType", "configKey",
        "payload", "version", "isActive", "softDelete",
        "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${user.tenantId}, ${dto.configType}, ${dto.configKey},
        ${JSON.stringify(dto.payload)}::jsonb, ${nextVersion}, true, false,
        ${user.sub}, ${new Date()}, ${new Date()}
      )
    `;

    const auditPayload: AuditEventRequestedPayload = {
      action: 'CONFIG_UPDATE',
      entity: 'ConfigMaster',
      entityId: `${user.tenantId}:${dto.configType}:${dto.configKey}`,
      summary: `Config updated to version ${nextVersion}`,
      module: 'config',
      before: currentRecord?.payload as Record<string, unknown> | undefined,
      after: dto.payload,
      metadata: { configType: dto.configType, configKey: dto.configKey, version: nextVersion },
    };

    await this.publishAuditEvent(user, auditPayload);

    return { saved: true, version: nextVersion, payload: dto };
  }

  // â”€â”€â”€ Config rollback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async rollbackConfig(
    tenantId: string,
    configType: string,
    configKey: string,
    targetVersion: number,
    user: JwtClaims,
  ): Promise<{ rolledBack: boolean; version: number }> {
    const target = await this.prisma.$queryRaw<Array<{ id: string; version: number }>>`
      SELECT "id", "version"
      FROM "ConfigMaster"
      WHERE "tenantId"   = ${tenantId}
        AND "configType" = ${configType}
        AND "configKey"  = ${configKey}
        AND "version"    = ${targetVersion}
        AND "softDelete" = false
      LIMIT 1
    `;

    if (!target[0]) {
      throw new NotFoundException(`Config version ${targetVersion} not found for ${configType}:${configKey}`);
    }

    // Deactivate current active version.
    await this.prisma.$executeRaw`
      UPDATE "ConfigMaster"
      SET "isActive" = false, "updatedAt" = ${new Date()}, "updatedBy" = ${user.sub}
      WHERE "tenantId"   = ${tenantId}
        AND "configType" = ${configType}
        AND "configKey"  = ${configKey}
        AND "isActive"   = true
    `;

    // Reactivate the target version.
    await this.prisma.$executeRaw`
      UPDATE "ConfigMaster"
      SET "isActive" = true, "updatedAt" = ${new Date()}, "updatedBy" = ${user.sub}
      WHERE "id" = ${target[0].id}
    `;

    await this.publishAuditEvent(user, {
      action: 'CONFIG_ROLLBACK',
      entity: 'ConfigMaster',
      entityId: `${tenantId}:${configType}:${configKey}`,
      summary: `Config rolled back to version ${targetVersion}`,
      module: 'config',
      metadata: { configType, configKey, version: targetVersion },
    });

    return { rolledBack: true, version: targetVersion };
  }

  // â”€â”€â”€ Module entitlements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getModuleEntitlements(tenantId: string): Promise<ModuleEntitlementRow[]> {
    return this.prisma.$queryRaw<ModuleEntitlementRow[]>`
      SELECT "moduleKey", "enabled", "enabledBy", "disabledBy", "enabledAt", "disabledAt"
      FROM "ModuleEntitlement"
      WHERE "tenantId"   = ${tenantId}
        AND "softDelete" = false
      ORDER BY "moduleKey" ASC
    `;
  }

  async toggleModule(
    tenantId: string,
    moduleKey: string,
    enable: boolean,
    user: JwtClaims,
  ): Promise<{ moduleKey: string; enabled: boolean }> {
    const now = new Date();
    const id = randomUUID();

    // UPSERT: insert the entitlement record if it does not yet exist; otherwise update.
    await this.prisma.$executeRaw`
      INSERT INTO "ModuleEntitlement"
        ("id", "tenantId", "moduleKey", "enabled",
         "enabledBy", "enabledAt", "disabledBy", "disabledAt",
         "softDelete", "createdAt", "updatedAt")
      VALUES (
        ${id}, ${tenantId}, ${moduleKey}, ${enable},
        CASE WHEN ${enable} THEN ${user.sub} ELSE NULL END,
        CASE WHEN ${enable} THEN ${now}     ELSE NULL END,
        CASE WHEN ${!enable} THEN ${user.sub} ELSE NULL END,
        CASE WHEN ${!enable} THEN ${now}      ELSE NULL END,
        false, ${now}, ${now}
      )
      ON CONFLICT ("tenantId", "moduleKey") DO UPDATE
        SET
          "enabled"    = EXCLUDED."enabled",
          "enabledBy"  = CASE WHEN ${enable}  THEN ${user.sub} ELSE "enabledBy"  END,
          "disabledBy" = CASE WHEN ${!enable} THEN ${user.sub} ELSE "disabledBy" END,
          "enabledAt"  = CASE WHEN ${enable}  THEN ${now}      ELSE "enabledAt"  END,
          "disabledAt" = CASE WHEN ${!enable} THEN ${now}      ELSE "disabledAt" END,
          "updatedAt"  = ${now}
        WHERE "ModuleEntitlement"."softDelete" = false
    `;

    // RISK-07 fix: broadcast module toggle so gateway/other services can react.
    const routingKey = enable ? MODULE_ENABLED_ROUTING_KEY : MODULE_DISABLED_ROUTING_KEY;
    const togglePayload: ModuleTogglePayload = { tenantId, moduleKey, enabled: enable, changedBy: user.sub };
    const toggleEnvelope: EventEnvelope<ModuleTogglePayload> = {
      eventId: randomUUID(),
      eventType: routingKey,
      eventVersion: '1.0.0',
      tenantId,
      occurredAt: now.toISOString(),
      correlationId: randomUUID(),
      producer: { service: 'config-service' },
      actor: { actorType: 'USER', actorId: user.sub, role: user.roles[0] ?? 'SCHOOL_ADMIN' },
      payload: togglePayload,
    };
    await this.publisher.publish(routingKey, toggleEnvelope);

    await this.publishAuditEvent(user, {
      action: enable ? 'MODULE_ENABLE' : 'MODULE_DISABLE',
      entity: 'ModuleEntitlement',
      entityId: `${tenantId}:${moduleKey}`,
      summary: `Module ${moduleKey} ${enable ? 'enabled' : 'disabled'}`,
      module: 'config',
      metadata: { moduleKey, enabled: enable },
    });

    return { moduleKey, enabled: enable };
  }

  // â”€â”€â”€ TenantCreated event handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async handleTenantCreatedEvent(
    envelope: EventEnvelope<TenantCreatedPayload>,
  ): Promise<void> {
    const processed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ProcessedEvent"
      WHERE "eventId" = ${envelope.eventId}
      LIMIT 1
    `;
    if (processed.length > 0) return;

    const moduleDefaults: Array<{ moduleKey: string; enabled: boolean }> = [
      { moduleKey: 'attendance', enabled: true },
      { moduleKey: 'fees',       enabled: true },
      { moduleKey: 'exam',       enabled: true },
      { moduleKey: 'portal',     enabled: true },
      { moduleKey: 'website',    enabled: true },
      { moduleKey: 'library',    enabled: false },
      { moduleKey: 'transport',  enabled: false },
      { moduleKey: 'hostel',     enabled: false },
    ];

    for (const item of moduleDefaults) {
      await this.prisma.$executeRaw`
        INSERT INTO "ModuleEntitlement" (
          "id", "tenantId", "moduleKey", "enabled",
          "softDelete", "createdAt", "updatedAt"
        )
        VALUES (
          ${randomUUID()}, ${envelope.tenantId}, ${item.moduleKey}, ${item.enabled},
          false, ${new Date()}, ${new Date()}
        )
        ON CONFLICT ("tenantId", "moduleKey") DO NOTHING
      `;
    }

    // RISK-05 fix: version-aware default config seeding.
    const configDefaults = [
      { configType: 'GRADING',  configKey: 'default',         payload: { scale: 'A-F', passMark: 40 } },
      { configType: 'ACADEMIC', configKey: 'default',         payload: { termSystem: 'semester', sessions: 2 } },
      { configType: 'WORKFLOW', configKey: 'result_publish',  payload: { approvalRequired: true } },
    ];

    for (const item of configDefaults) {
      const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ConfigMaster"
        WHERE "tenantId"   = ${envelope.tenantId}
          AND "configType" = ${item.configType}
          AND "configKey"  = ${item.configKey}
        LIMIT 1
      `;
      if (existing.length > 0) continue;

      await this.prisma.$executeRaw`
        INSERT INTO "ConfigMaster" (
          "id", "tenantId", "configType", "configKey",
          "payload", "version", "isActive", "softDelete",
          "createdBy", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${envelope.tenantId}, ${item.configType}, ${item.configKey},
          ${JSON.stringify(item.payload)}::jsonb, 1, true, false,
          'system', ${new Date()}, ${new Date()}
        )
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
      summary: 'Default entitlements and configuration seeded for new tenant',
      module: 'config',
      metadata: { tenantId: envelope.tenantId },
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

  // â”€â”€â”€ Private helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async publishAuditEvent(
    user: JwtClaims,
    payload: AuditEventRequestedPayload,
  ): Promise<void> {
    const envelope: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId: user.tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      producer: { service: 'config-service' },
      actor: { actorType: 'USER', actorId: user.sub, role: user.roles[0] ?? 'USER' },
      payload,
    };
    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, envelope);
  }
}