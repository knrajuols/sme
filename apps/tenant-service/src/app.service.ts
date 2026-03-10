import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SchoolStatus, TenantStatus } from './generated/prisma-client';
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
import { UpdateTenantDto } from './dto/update-tenant.dto';
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

  async getTenantStatusById(tenantId: string): Promise<{ tenantId: string; status: string }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status"
      FROM "Tenant"
      WHERE "id" = ${tenantId}
      LIMIT 1
    `;

    const tenant = rows[0];
    if (!tenant) {
      throw new ForbiddenException({
        message: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      });
    }

    return {
      tenantId: tenant.id,
      status: tenant.status,
    };
  }

  async getTenantProfileById(tenantId: string): Promise<{ tenantId: string; tenantCode: string; schoolName: string; status: string }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; code: string; name: string; status: string }>>`
      SELECT "id", "code", "name", "status"
      FROM "Tenant"
      WHERE "id" = ${tenantId}
      LIMIT 1
    `;

    const tenant = rows[0];
    if (!tenant) {
      throw new ForbiddenException({
        message: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      });
    }

    return {
      tenantId: tenant.id,
      tenantCode: tenant.code,
      schoolName: tenant.name,
      status: tenant.status,
    };
  }

  async getTenantFullProfileById(tenantId: string): Promise<{
    tenantId: string; tenantCode: string; schoolName: string; legalName: string | null;
    udiseCode: string | null; affiliationNumber: string | null; board: string | null;
    address: string | null; city: string | null; state: string | null;
    pincode: string | null; district: string | null;
    contactPhone: string | null; contactEmail: string | null; website: string | null;
    establishmentYear: number | null; schoolType: string | null; managementType: string | null;
    lowestClass: string | null; highestClass: string | null;
    schoolStatus: string; tenantStatus: string; createdAt: string; updatedAt: string;
  }> {
    // Use findFirst (not findUnique) so the soft-delete middleware can safely
    // add softDelete=false to the where clause without violating Prisma's
    // constraint that findUnique.where must contain only unique fields.
    const row = await this.prisma.tenant.findFirst({
      where: { id: tenantId, softDelete: false },
      select: {
        id: true, code: true, name: true, legalName: true,
        status: true, schoolStatus: true,
        udiseCode: true, affiliationNumber: true, board: true,
        address: true, city: true, state: true, pincode: true, district: true,
        contactPhone: true, contactEmail: true, website: true,
        establishmentYear: true, schoolType: true, managementType: true,
        lowestClass: true, highestClass: true,
        createdAt: true, updatedAt: true,
      },
    });

    if (!row) {
      throw new ForbiddenException({ message: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
    }

    return {
      tenantId: row.id,
      tenantCode: row.code,
      schoolName: row.name,
      legalName: row.legalName ?? null,
      udiseCode: row.udiseCode ?? null,
      affiliationNumber: row.affiliationNumber ?? null,
      board: row.board ?? null,
      address: row.address ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      pincode: row.pincode ?? null,
      district: row.district ?? null,
      contactPhone: row.contactPhone ?? null,
      contactEmail: row.contactEmail ?? null,
      website: row.website ?? null,
      establishmentYear: row.establishmentYear ?? null,
      schoolType: row.schoolType ?? null,
      managementType: row.managementType ?? null,
      lowestClass: row.lowestClass ?? null,
      highestClass: row.highestClass ?? null,
      schoolStatus: row.schoolStatus,
      tenantStatus: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateOwnTenantProfile(
    tenantId: string,
    dto: Omit<UpdateTenantDto, 'schoolName' | 'udiseCode' | 'schoolStatus'>,
  ): Promise<{ tenantId: string; updated: boolean }> {
    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.legalName         !== undefined) data.legalName         = dto.legalName;
    if (dto.affiliationNumber !== undefined) data.affiliationNumber = dto.affiliationNumber;
    if (dto.board             !== undefined) data.board             = dto.board;
    if (dto.address           !== undefined) data.address           = dto.address;
    if (dto.city              !== undefined) data.city              = dto.city;
    if (dto.state             !== undefined) data.state             = dto.state;
    if (dto.pincode           !== undefined) data.pincode           = dto.pincode;
    if (dto.district          !== undefined) data.district          = dto.district;

    // [ERR-TEN-PROF-4091] Uniqueness checks — contactEmail and contactPhone must be
    // globally unique across all tenants (excluding the current tenant).
    if (dto.contactPhone !== undefined && dto.contactPhone !== null) {
      const phoneConflict = await this.prisma.tenant.findFirst({
        where: { contactPhone: dto.contactPhone as string, id: { not: tenantId }, softDelete: false },
        select: { id: true },
      });
      if (phoneConflict) {
        throw new ConflictException({
          message: '[ERR-TEN-PROF-4091] This phone number is already registered to another school.',
          code: 'DUPLICATE_PHONE',
          field: 'contactPhone',
        });
      }
    }
    if (dto.contactEmail !== undefined && dto.contactEmail !== null) {
      const emailConflict = await this.prisma.tenant.findFirst({
        where: { contactEmail: dto.contactEmail as string, id: { not: tenantId }, softDelete: false },
        select: { id: true },
      });
      if (emailConflict) {
        throw new ConflictException({
          message: '[ERR-TEN-PROF-4092] This email address is already registered to another school.',
          code: 'DUPLICATE_EMAIL',
          field: 'contactEmail',
        });
      }
    }

    if (dto.contactPhone      !== undefined) data.contactPhone      = dto.contactPhone;
    if (dto.contactEmail      !== undefined) data.contactEmail      = dto.contactEmail;
    if (dto.website           !== undefined) data.website           = dto.website;
    if (dto.establishmentYear !== undefined) data.establishmentYear = dto.establishmentYear;
    if (dto.schoolType        !== undefined) data.schoolType        = dto.schoolType;
    if (dto.managementType    !== undefined) data.managementType    = dto.managementType;
    if (dto.lowestClass       !== undefined) data.lowestClass       = dto.lowestClass;
    if (dto.highestClass      !== undefined) data.highestClass      = dto.highestClass;
    await this.prisma.tenant.update({ where: { id: tenantId }, data });
    return { tenantId, updated: true };
  }

  async listPendingTenants(): Promise<Array<{ tenantId: string; tenantCode: string; schoolName: string; status: string; createdAt: string }>> {
    const rows = await this.prisma.tenant.findMany({
      where: { schoolStatus: SchoolStatus.PENDING },
      select: { id: true, code: true, name: true, schoolStatus: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((item) => ({
      tenantId: item.id,
      tenantCode: item.code,
      schoolName: item.name,
      status: item.schoolStatus,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async listAllTenants(): Promise<Array<{
    tenantId: string; tenantCode: string; schoolName: string; legalName: string | null;
    schoolStatus: string; tenantStatus: string; udiseCode: string | null;
    affiliationNumber: string | null; board: string | null; address: string | null;
    city: string | null; state: string | null; pincode: string | null; district: string | null;
    contactPhone: string | null; contactEmail: string | null; website: string | null;
    establishmentYear: number | null; schoolType: string | null; managementType: string | null;
    lowestClass: string | null; highestClass: string | null;
    createdAt: string; updatedAt: string;
  }>> {
    const rows = await this.prisma.tenant.findMany({
      where: { softDelete: false },
      select: {
        id: true, code: true, name: true, legalName: true,
        schoolStatus: true, status: true,
        udiseCode: true, affiliationNumber: true, board: true,
        address: true, city: true, state: true, pincode: true, district: true,
        contactPhone: true, contactEmail: true, website: true,
        establishmentYear: true, schoolType: true, managementType: true,
        lowestClass: true, highestClass: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      tenantId: r.id,
      tenantCode: r.code,
      schoolName: r.name,
      legalName: r.legalName ?? null,
      schoolStatus: r.schoolStatus,
      tenantStatus: r.status,
      udiseCode: r.udiseCode ?? null,
      affiliationNumber: r.affiliationNumber ?? null,
      board: r.board ?? null,
      address: r.address ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
      pincode: r.pincode ?? null,
      district: r.district ?? null,
      contactPhone: r.contactPhone ?? null,
      contactEmail: r.contactEmail ?? null,
      website: r.website ?? null,
      establishmentYear: r.establishmentYear ?? null,
      schoolType: r.schoolType ?? null,
      managementType: r.managementType ?? null,
      lowestClass: r.lowestClass ?? null,
      highestClass: r.highestClass ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto): Promise<{ tenantId: string; updated: boolean }> {
    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.schoolName     !== undefined) data.name               = dto.schoolName;
    if (dto.legalName      !== undefined) data.legalName          = dto.legalName;
    if (dto.udiseCode      !== undefined) data.udiseCode          = dto.udiseCode;
    if (dto.affiliationNumber !== undefined) data.affiliationNumber = dto.affiliationNumber;
    if (dto.board          !== undefined) data.board              = dto.board;
    if (dto.address        !== undefined) data.address            = dto.address;
    if (dto.city           !== undefined) data.city               = dto.city;
    if (dto.state          !== undefined) data.state              = dto.state;
    if (dto.pincode        !== undefined) data.pincode            = dto.pincode;
    if (dto.district       !== undefined) data.district           = dto.district;
    if (dto.contactPhone   !== undefined) data.contactPhone       = dto.contactPhone;
    if (dto.contactEmail   !== undefined) data.contactEmail       = dto.contactEmail;
    if (dto.website        !== undefined) data.website            = dto.website;
    if (dto.establishmentYear !== undefined) data.establishmentYear = dto.establishmentYear;
    if (dto.schoolType     !== undefined) data.schoolType         = dto.schoolType;
    if (dto.managementType !== undefined) data.managementType     = dto.managementType;
    if (dto.lowestClass    !== undefined) data.lowestClass        = dto.lowestClass;
    if (dto.highestClass   !== undefined) data.highestClass       = dto.highestClass;
    if (dto.schoolStatus   !== undefined) data.schoolStatus       = dto.schoolStatus;

    await this.prisma.tenant.update({ where: { id: tenantId }, data });
    return { tenantId, updated: true };
  }

  async activateTenant(tenantId: string): Promise<{ tenantId: string; status: string }> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.ACTIVE,
        schoolStatus: SchoolStatus.ACTIVE,
        updatedAt: new Date(),
      },
    });

    const status = await this.getTenantStatusById(tenantId);
    return status;
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

    // ── Persist to database ────────────────────────────────────────────────
    let saved: { id: string; code: string; name: string };
    try {
      saved = await this.prisma.tenant.create({
        data: {
          id:           tenantId,
          code:         dto.tenantCode,
          name:         dto.schoolName,
          // Hardcoded to PENDING — every self-registered school awaits platform approval
          schoolStatus: SchoolStatus.PENDING,
          // Enterprise fields
          udiseCode:    dto.udiseCode    ?? null,
          address:      dto.address     ?? null,
          city:         dto.city        ?? null,
          state:        dto.state       ?? null,
          pincode:      dto.pincode     ?? null,
          district:     dto.district   ?? null,
          contactPhone:    dto.contactPhone ?? dto.primaryContactPhone ?? null,
          contactEmail:    dto.primaryContactEmail,
          schoolAdminName: dto.primaryContactName ?? null,
          createdAt:       now,
          updatedAt:       now,
        },
        select: { id: true, code: true, name: true },
      });
    } catch (err: unknown) {
      // Use early-throw narrowing — the most TypeScript-idiomatic pattern for
      // instanceof class guards. After each early throw, the type is fully narrowed
      // and all Prisma error properties are accessible with complete type safety.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError)) throw err;
      if (err.code !== 'P2002') throw err;

      // err is now fully narrowed to Prisma.PrismaClientKnownRequestError with code 'P2002'
      const fields = (err.meta?.target as string[] | undefined) ?? [];
      if (fields.some(f => f.toLowerCase().includes('udisecode'))) {
        throw new ConflictException(
          `A school with UDISE code "${dto.udiseCode}" is already registered. ` +
          'Please verify the code or contact support if this is an error.',
        );
      }
      if (fields.some(f => f.toLowerCase() === 'code')) {
        throw new ConflictException(
          `The subdomain "${dto.tenantCode}" is already taken. ` +
          'Please choose a different school identifier.',
        );
      }
      if (fields.some(f => f.toLowerCase().includes('contactemail'))) {
        throw new ConflictException(
          `A school with admin email "${dto.primaryContactEmail}" is already registered. ` +
          'Each school must use a unique admin email address.',
        );
      }
      throw new ConflictException(
        'A school with these details already exists. Please check your inputs.',
      );
    }

    const payload: TenantCreatedPayload = {
      tenantId: saved.id,
      tenantCode: saved.code,
      schoolName: saved.name,
      status: 'pending_activation',
      primaryContactName: dto.primaryContactName,
      primaryContactEmail: dto.primaryContactEmail,
      ...(dto.primaryContactPhone || dto.contactPhone
        ? { primaryContactPhone: dto.primaryContactPhone ?? dto.contactPhone }
        : {}),
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
      tenantId: saved.id,
      tenantCode: saved.code,
    };
  }
}
