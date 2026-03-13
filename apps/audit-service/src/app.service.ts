import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';

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

interface AuditEventRow {
  id: string;
  tenantId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  moduleKey: string | null;
  correlationId: string | null;
  actorType: string | null;
  actorId: string | null;
  sourceService: string | null;
  beforeSnapshot: unknown | null;
  afterSnapshot: unknown | null;
  rowHash: string | null;
  createdAt: Date;
}

/** Compute a deterministic row hash for tamper-evidence (RISK-04 fix). */
function computeRowHash(params: {
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null | undefined;
  occurredAt: string;
}): string {
  const raw = `${params.tenantId}|${params.action}|${params.entityType}|${params.entityId}|${params.actorId ?? ''}|${params.occurredAt}`;
  return createHash('sha256').update(raw).digest('hex');
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

  // â”€â”€â”€ Direct REST write (requires AUDIT_VIEW permission) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async create(dto: CreateAuditEventDto): Promise<{ persisted: boolean; event: CreateAuditEventDto }> {
    const now = new Date();
    const rowHash = computeRowHash({
      tenantId: dto.tenantId,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      actorId: dto.actorId,
      occurredAt: now.toISOString(),
    });

    // RISK-04 fix: tenantId non-nullable; all structured columns populated.
    await this.prisma.$executeRaw`
      INSERT INTO "AuditEvent" (
        "id", "tenantId", "correlationId",
        "actorType", "actorId", "actorRole",
        "moduleKey", "entityType", "entityId",
        "action", "beforeSnapshot", "afterSnapshot",
        "reason", "sourceService", "ipAddress", "userAgent",
        "rowHash", "createdAt"
      ) VALUES (
        ${randomUUID()},
        ${dto.tenantId},
        ${dto.correlationId},
        ${dto.actorType}::"AuditActorType",
        ${dto.actorId ?? null},
        ${dto.actorRole ?? null},
        ${dto.moduleKey},
        ${dto.entityType},
        ${dto.entityId},
        ${dto.action},
        ${dto.beforeSnapshot ? JSON.stringify(dto.beforeSnapshot) : null}::jsonb,
        ${dto.afterSnapshot  ? JSON.stringify(dto.afterSnapshot)  : null}::jsonb,
        ${dto.reason ?? null},
        ${dto.sourceService ?? 'direct'},
        ${dto.ipAddress ?? null},
        ${dto.userAgent ?? null},
        ${rowHash},
        ${now}
      )
    `;

    return { persisted: true, event: dto };
  }

  // â”€â”€â”€ Message consumer handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async handleAuditEventRequested(
    envelope: EventEnvelope<AuditEventRequestedPayload>,
  ): Promise<void> {
    const p   = envelope.payload;
    const now = new Date();

    const rowHash = computeRowHash({
      tenantId:   envelope.tenantId,
      action:     p.action,
      entityType: p.entity,
      entityId:   p.entityId,
      actorId:    envelope.actor?.actorId,
      occurredAt: envelope.occurredAt,
    });

    // RISK-04 fix: structured columns + non-nullable tenantId.
    await this.prisma.$executeRaw`
      INSERT INTO "AuditEvent" (
        "id", "tenantId", "correlationId",
        "actorType", "actorId", "actorRole",
        "moduleKey", "entityType", "entityId",
        "action", "beforeSnapshot", "afterSnapshot",
        "reason", "sourceService", "ipAddress", "userAgent",
        "rowHash", "createdAt"
      ) VALUES (
        ${randomUUID()},
        ${envelope.tenantId},
        ${envelope.correlationId ?? randomUUID()},
        ${envelope.actor?.actorType ?? 'SYSTEM'}::"AuditActorType",
        ${envelope.actor?.actorId ?? null},
        ${envelope.actor?.role ?? null},
        ${p.module ?? 'system'},
        ${p.entity},
        ${p.entityId},
        ${p.action},
        ${p.before != null ? JSON.stringify(p.before) : null}::jsonb,
        ${p.after  != null ? JSON.stringify(p.after)  : null}::jsonb,
        ${p.summary ?? null},
        ${envelope.producer?.service ?? 'unknown'},
        {((p as unknown) as Record<string, unknown>)['ipAddress'] as string ?? null},
        {((p as unknown) as Record<string, unknown>)['userAgent'] as string ?? null},
        ${rowHash},
        ${now}
      )
    `;
  }

  // â”€â”€â”€ Query: list by tenant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async findByTenantId(
    tenantId: string,
    user: JwtClaims,
    limit = 100,
    offset = 0,
  ): Promise<AuditEventRow[]> {
    if (!user.roles.includes('PLATFORM_ADMIN') && user.tenantId !== tenantId) {
      throw new ForbiddenException({
        type: 'https://sme.example.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Cross-tenant access is forbidden',
        code: 'TENANT_SCOPE_VIOLATION',
      });
    }

    return this.prisma.$queryRaw<AuditEventRow[]>`
      SELECT
        "id", "tenantId", "action", "entityType", "entityId",
        "moduleKey", "correlationId", "actorType", "actorId",
        "sourceService", "beforeSnapshot", "afterSnapshot", "rowHash",
        "createdAt"
      FROM "AuditEvent"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
}