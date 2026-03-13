import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';

import type { JwtClaims } from '@sme/auth';
import { JwtTokenService } from '@sme/auth';
import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  checkRabbitMqConnection,
  checkRedisPing,
  EventEnvelope,
  TenantCreatedPayload,
} from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';

import { AuthTokenRequestDto } from './dto/auth-token-request.dto';
import { PrismaService } from './prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

interface ReadinessDetail {
  status: 'ok' | 'fail';
  code?: string;
}

interface ReadinessResult {
  ok: boolean;
  details: Record<string, ReadinessDetail>;
}

// â”€â”€â”€ Permissions catalogue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PERMISSIONS = [
  'TENANT_CREATE',
  'USER_CREATE',
  'ROLE_ASSIGN',
  'MODULE_ENABLE',
  'MODULE_DISABLE',
  'CONFIG_UPDATE',
  'AUDIT_VIEW',
  'ACADEMIC_YEAR_CREATE',
  'CLASS_CREATE',
  'SECTION_CREATE',
  'SUBJECT_CREATE',
  'STUDENT_CREATE',
  'TEACHER_ASSIGN',
  'ATTENDANCE_SESSION_CREATE',
  'ATTENDANCE_MARK',
  'ATTENDANCE_VIEW',
  'EXAM_CREATE',
  'EXAM_SUBJECT_ADD',
  'MARKS_ENTER',
  'EXAM_VERIFY',
  'EXAM_PUBLISH',
  'RESULT_VIEW',
  'ANALYTICS_VIEW',
  'PORTAL_VIEW',
] as const;

/** Maps each permission code to its owning module key (used in Permission.moduleKey). */
const PERMISSION_MODULE: Record<string, string> = {
  TENANT_CREATE:              'iam',
  USER_CREATE:                'iam',
  ROLE_ASSIGN:                'iam',
  MODULE_ENABLE:              'config',
  MODULE_DISABLE:             'config',
  CONFIG_UPDATE:              'config',
  AUDIT_VIEW:                 'audit',
  ACADEMIC_YEAR_CREATE:       'academics',
  CLASS_CREATE:               'academics',
  SECTION_CREATE:             'academics',
  SUBJECT_CREATE:             'academics',
  STUDENT_CREATE:             'academics',
  TEACHER_ASSIGN:             'academics',
  ATTENDANCE_SESSION_CREATE:  'attendance',
  ATTENDANCE_MARK:            'attendance',
  ATTENDANCE_VIEW:            'attendance',
  EXAM_CREATE:                'exams',
  EXAM_SUBJECT_ADD:           'exams',
  MARKS_ENTER:                'exams',
  EXAM_VERIFY:                'exams',
  EXAM_PUBLISH:               'exams',
  RESULT_VIEW:                'exams',
  ANALYTICS_VIEW:             'analytics',
  PORTAL_VIEW:                'portal',
};

/** Stable placeholder hash for accounts created without a password (first-login flow). */
const PLACEHOLDER_PASSWORD_HASH = '$PLACEHOLDER$';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly publisher: MessagePublisherService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensurePermissionModel();
  }

  live(): { service: string; status: string } {
    return { service: 'iam-service', status: 'ok' };
  }

  async health(): Promise<{ service: string; status: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { service: 'iam-service', status: 'up' };
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // User management
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createUser(
    dto: CreateUserDto,
    tenantId: string,
  ): Promise<{ created: boolean; user: CreateUserDto & { tenantId: string } }> {
    // RISK-01 fix: ON CONFLICT uses the composite (tenantId, email) unique key.
    await this.prisma.$executeRaw`
      INSERT INTO "User" (
        "id", "tenantId", "email", "displayName", "passwordHash",
        "status", "softDelete", "version", "createdAt", "updatedAt"
      )
      VALUES (
        ${randomUUID()}, ${tenantId}, ${dto.email}, ${dto.displayName},
        ${PLACEHOLDER_PASSWORD_HASH}, 'ACTIVE', false, 1,
        ${new Date()}, ${new Date()}
      )
      ON CONFLICT ("tenantId", "email") DO UPDATE SET
        "displayName" = EXCLUDED."displayName",
        "updatedAt"   = EXCLUDED."updatedAt"
    `;

    return { created: true, user: { ...dto, tenantId } };
  }

  async listUsers(
    tenantId: string,
  ): Promise<Array<{ id: string; email: string | null; displayName: string; tenantId: string }>> {
    return this.prisma.$queryRaw<Array<{ id: string; email: string | null; displayName: string; tenantId: string }>>`
      SELECT "id", "email", "displayName", "tenantId"
      FROM "User"
      WHERE "tenantId" = ${tenantId}
        AND "softDelete" = false
      ORDER BY "createdAt" ASC
    `;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Authentication
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // TODO: [PROD SECURITY] ─────────────────────────────────────────────────────
  // DEV MODE AUTH BYPASS IS ACTIVE.
  // Password validation is intentionally SKIPPED for local development.
  // The AuthTokenRequestDto contains NO password field.
  // Any user that exists in the DB can log in with email alone.
  //
  // Before going to production you MUST:
  //   1. Add a `password` field to AuthTokenRequestDto (IsString, MinLength 8)
  //   2. Add bcrypt comparison:
  //        import * as bcrypt from 'bcrypt';
  //        const valid = await bcrypt.compare(dto.password, user.passwordHash);
  //        if (!valid) { throw new UnauthorizedException('Invalid credentials'); }
  //   3. Ensure passwordHash is selected in the DB query below
  //   4. Remove this comment block
  // ─────────────────────────────────────────────────────────────────────────────
  async issueAccessToken(
    dto: AuthTokenRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; expiresIn: number; claims: JwtClaims }> {
    // DEV MODE: password validation skipped — any user in DB can login with email alone.
    // TODO (PROD): add bcrypt password check before go-live (see comment block above).
    const users = dto.tenantId
      ? await this.prisma.$queryRaw<Array<{ id: string; email: string | null; tenantId: string; status: string }>>`
          SELECT "id", "email", "tenantId", "status"
          FROM "User"
          WHERE "tenantId" = ${dto.tenantId}
            AND "email"    = ${dto.email}
            AND "softDelete" = false
          LIMIT 1
        `
      : await this.prisma.$queryRaw<Array<{ id: string; email: string | null; tenantId: string; status: string }>>`
          SELECT "id", "email", "tenantId", "status"
          FROM "User"
          WHERE "email" = ${dto.email}
            AND "softDelete" = false
          LIMIT 1
        `;

    const user = users[0];

    if (!user) {
      await this.writeLoginAudit({
        tenantId: dto.tenantId ?? 'unknown',
        userId: null,
        loginIdentifier: dto.email,
        success: false,
        ipAddress,
        userAgent,
        failReason: 'USER_NOT_FOUND',
      });
      throw new NotFoundException('User not found');
    }

    // Status check â€” RISK-01 / RISK-03 fix.
    if (user.status === 'SUSPENDED') {
      await this.writeLoginAudit({ tenantId: user.tenantId, userId: user.id, loginIdentifier: dto.email, success: false, ipAddress, userAgent, failReason: 'ACCOUNT_SUSPENDED' });
      throw new ForbiddenException('Account is suspended');
    }
    if (user.status === 'LOCKED') {
      await this.writeLoginAudit({ tenantId: user.tenantId, userId: user.id, loginIdentifier: dto.email, success: false, ipAddress, userAgent, failReason: 'ACCOUNT_LOCKED' });
      throw new ForbiddenException('Account is locked due to too many failed attempts');
    }
    if (user.status === 'PENDING_RESET') {
      await this.writeLoginAudit({ tenantId: user.tenantId, userId: user.id, loginIdentifier: dto.email, success: false, ipAddress, userAgent, failReason: 'PASSWORD_RESET_REQUIRED' });
      throw new ForbiddenException('Password reset is required before login');
    }

    const roleRows = await this.prisma.$queryRaw<Array<{ roleCode: string }>>`
      SELECT r."code" AS "roleCode"
      FROM "UserRole" ur
      INNER JOIN "Role" r ON r."id" = ur."roleId"
      WHERE ur."userId" = ${user.id}
      ORDER BY r."code" ASC
    `;

    const roles = roleRows.map((item) => item.roleCode);
    if (roles.length === 0) {
      await this.writeLoginAudit({ tenantId: user.tenantId, userId: user.id, loginIdentifier: dto.email, success: false, ipAddress, userAgent, failReason: 'NO_ROLES_ASSIGNED' });
      throw new ForbiddenException('User has no assigned roles');
    }

    const permissionRows = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT DISTINCT p."code"
      FROM "Permission" p
      INNER JOIN "RolePermission" rp ON rp."permissionId" = p."id"
      INNER JOIN "Role" r ON r."id" = rp."roleId"
      INNER JOIN "UserRole" ur ON ur."roleId" = r."id"
      WHERE ur."userId" = ${user.id}
      ORDER BY p."code" ASC
    `;

    const effectiveTenantId = roles.includes('PLATFORM_ADMIN') ? 'platform' : user.tenantId;
    if (!effectiveTenantId) {
      throw new ForbiddenException('User tenant context is missing');
    }

    // Tenant status check â€” only for non-platform users.
    if (!roles.includes('PLATFORM_ADMIN')) {
      const tenantServiceUrl = this.configService.get<string>('TENANT_SERVICE_URL') ?? 'http://localhost:3002';
      const statusUrl = `${tenantServiceUrl.replace(/\/$/, '')}/tenants/status/${effectiveTenantId}`;
      let tenantStatus = 'unknown';

      try {
        const statusResponse = await fetch(statusUrl, { method: 'GET' });
        const statusBody = (await statusResponse.json().catch(() => ({}))) as {
          message?: string;
          data?: { status?: string };
          status?: string;
        };

        if (!statusResponse.ok) {
          throw new BadGatewayException(statusBody?.message ?? 'Unable to verify tenant activation status');
        }

        tenantStatus = statusBody?.data?.status ?? statusBody?.status ?? 'unknown';
      } catch (error) {
        if (error instanceof BadGatewayException) throw error;
        throw new ServiceUnavailableException('Tenant status check failed during login');
      }

      if (tenantStatus !== 'ACTIVE' && tenantStatus !== 'active') {
        await this.writeLoginAudit({ tenantId: effectiveTenantId, userId: user.id, loginIdentifier: dto.email, success: false, ipAddress, userAgent, failReason: 'TENANT_NOT_ACTIVE' });
        throw new ForbiddenException('Your school is pending activation by platform admin');
      }
    }

    const expiresIn = Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? '3600');
    const sessionId = randomUUID();
    const accessToken = this.jwtTokenService.issueToken({
      sub: user.id,
      tenantId: effectiveTenantId,
      roles,
      permissions: permissionRows.map((item) => item.code),
      sessionId,
      expiresInSeconds: expiresIn,
    });

    const claims = this.jwtTokenService.verifyToken(accessToken);

    await this.writeLoginAudit({ tenantId: effectiveTenantId, userId: user.id, loginIdentifier: dto.email, success: true, ipAddress, userAgent, failReason: null });

    return { accessToken, expiresIn, claims };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Role assignment
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async assignRole(
    userId: string,
    roleCode: string,
    actor: JwtClaims,
  ): Promise<{ assigned: boolean; userId: string; roleCode: string }> {
    const userRows = await this.prisma.$queryRaw<Array<{ id: string; tenantId: string }>>`
      SELECT "id", "tenantId"
      FROM "User"
      WHERE "id" = ${userId}
        AND "softDelete" = false
      LIMIT 1
    `;

    const targetUser = userRows[0];
    if (!targetUser) throw new NotFoundException('Target user not found');

    const isPlatformAdmin = actor.roles.includes('PLATFORM_ADMIN');
    if (!isPlatformAdmin && targetUser.tenantId !== actor.tenantId) {
      throw new ForbiddenException({
        message: 'Cross-tenant role assignment is forbidden',
        code: 'TENANT_SCOPE_VIOLATION',
      });
    }

    // Roles are tenant-scoped; system roles have tenantId = 'platform'.
    const roleRows = await this.prisma.$queryRaw<Array<{ id: string; code: string; tenantId: string }>>`
      SELECT "id", "code", "tenantId"
      FROM "Role"
      WHERE "code" = ${roleCode}
        AND "tenantId" IN ('platform', ${targetUser.tenantId})
      LIMIT 1
    `;

    const role = roleRows[0];
    if (!role) throw new NotFoundException('Role not found');

    const assignTenantId = targetUser.tenantId;

    // RISK-02 fix: unique key now includes tenantId.
    await this.prisma.$executeRaw`
      INSERT INTO "UserRole" ("id", "tenantId", "userId", "roleId", "createdAt", "createdBy")
      VALUES (${randomUUID()}, ${assignTenantId}, ${targetUser.id}, ${role.id}, ${new Date()}, ${actor.sub})
      ON CONFLICT ("tenantId", "userId", "roleId") DO NOTHING
    `;

    await this.publishAuditEvent(
      {
        eventId: randomUUID(),
        eventType: 'iam.RoleAssigned',
        eventVersion: '1.0.0',
        tenantId: targetUser.tenantId,
        occurredAt: new Date().toISOString(),
        correlationId: randomUUID(),
        producer: { service: 'iam-service' },
        actor: { actorType: 'USER', actorId: actor.sub, role: actor.roles[0] ?? 'USER' },
        payload: {} as never,
      },
      {
        action: 'ASSIGN_ROLE',
        entity: 'UserRole',
        entityId: `${targetUser.id}:${role.code}`,
        summary: 'Role assigned to user',
        metadata: { userId: targetUser.id, roleCode: role.code },
        module: 'iam',
      },
    );

    return { assigned: true, userId: targetUser.id, roleCode: role.code };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Tenant onboarding activation
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async activateTenantOnboarding(
    tenantId: string,
    actor: JwtClaims,
    _correlationId?: string,
  ): Promise<{ tenantId: string; activatedUsers: Array<{ email: string | null }> }> {
    if (!actor.roles.includes('PLATFORM_ADMIN')) {
      throw new ForbiddenException('Only platform admin can activate tenant onboarding');
    }

    // Activate all PENDING_RESET users for this tenant (e.g. school admin created at onboarding).
    await this.prisma.$executeRaw`
      UPDATE "User"
      SET "status"    = 'ACTIVE',
          "updatedAt" = ${new Date()}
      WHERE "tenantId"    = ${tenantId}
        AND "softDelete"  = false
        AND "status"      = 'PENDING_RESET'
    `;

    const users = await this.prisma.$queryRaw<Array<{ email: string | null }>>`
      SELECT "email"
      FROM "User"
      WHERE "tenantId"   = ${tenantId}
        AND "softDelete" = false
      ORDER BY "createdAt" ASC
    `;

    return { tenantId, activatedUsers: users };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Event consumers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async handleTenantCreatedEvent(
    envelope: EventEnvelope<TenantCreatedPayload>,
  ): Promise<void> {
    const alreadyProcessed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ProcessedEvent"
      WHERE "eventId" = ${envelope.eventId}
      LIMIT 1
    `;
    if (alreadyProcessed.length > 0) return;

    // Seed tenant-scoped SCHOOL_ADMIN role.
    // RISK-02 fix: tenantId included in Role INSERT.
    await this.prisma.$executeRaw`
      INSERT INTO "Role" (
        "id", "tenantId", "code", "name", "description",
        "isSystem", "softDelete", "version", "createdAt", "updatedAt"
      )
      VALUES (
        ${randomUUID()}, ${envelope.tenantId}, 'SCHOOL_ADMIN',
        'School Administrator', 'Default admin role for tenant onboarding',
        true, false, 1, ${new Date()}, ${new Date()}
      )
      ON CONFLICT ("tenantId", "code") DO NOTHING
    `;

    const roleRows = await this.prisma.$queryRaw<Array<{ id: string; code: string }>>`
      SELECT "id", "code"
      FROM "Role"
      WHERE "code"     = 'SCHOOL_ADMIN'
        AND "tenantId" = ${envelope.tenantId}
      LIMIT 1
    `;
    const role = roleRows[0];
    if (!role) return;

    // Find or create the primary contact user (tenant-scoped).
    const existingUsers = await this.prisma.$queryRaw<Array<{ id: string; email: string | null }>>`
      SELECT "id", "email"
      FROM "User"
      WHERE "tenantId" = ${envelope.tenantId}
        AND "email"    = ${envelope.payload.primaryContactEmail}
      LIMIT 1
    `;
    const existingUser = existingUsers[0];

    let userId: string;
    let isNew = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      userId = randomUUID();
      // RISK-01 fix: composite (tenantId, email) key.
      await this.prisma.$executeRaw`
        INSERT INTO "User" (
          "id", "tenantId", "email", "displayName", "passwordHash",
          "status", "softDelete", "version", "createdAt", "updatedAt"
        )
        VALUES (
          ${userId}, ${envelope.tenantId},
          ${envelope.payload.primaryContactEmail},
          ${envelope.payload.primaryContactName},
          ${PLACEHOLDER_PASSWORD_HASH},
          'PENDING_RESET', false, 1, ${new Date()}, ${new Date()}
        )
      `;
      isNew = true;
    }

    // Assign SCHOOL_ADMIN role â€” RISK-02 fix: composite (tenantId, userId, roleId).
    const existingUserRoles = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "UserRole"
      WHERE "tenantId" = ${envelope.tenantId}
        AND "userId"   = ${userId}
        AND "roleId"   = ${role.id}
      LIMIT 1
    `;

    let userRoleId: string | null = existingUserRoles[0]?.id ?? null;
    if (!userRoleId) {
      userRoleId = randomUUID();
      await this.prisma.$executeRaw`
        INSERT INTO "UserRole" ("id", "tenantId", "userId", "roleId", "createdAt")
        VALUES (${userRoleId}, ${envelope.tenantId}, ${userId}, ${role.id}, ${new Date()})
        ON CONFLICT ("tenantId", "userId", "roleId") DO NOTHING
      `;
    }

    // Also wire tenant-scoped SCHOOL_ADMIN role permissions to mirror platform seed.
    await this.assignRolePermissions(role.id, envelope.tenantId, [
      'USER_CREATE', 'ROLE_ASSIGN', 'MODULE_ENABLE', 'MODULE_DISABLE',
      'ACADEMIC_YEAR_CREATE', 'CLASS_CREATE', 'SECTION_CREATE', 'SUBJECT_CREATE',
      'STUDENT_CREATE', 'TEACHER_ASSIGN', 'ATTENDANCE_SESSION_CREATE',
      'ATTENDANCE_MARK', 'ATTENDANCE_VIEW', 'EXAM_CREATE', 'EXAM_SUBJECT_ADD',
      'MARKS_ENTER', 'EXAM_VERIFY', 'EXAM_PUBLISH', 'RESULT_VIEW', 'ANALYTICS_VIEW',
    ]);

    await this.prisma.$executeRaw`
      INSERT INTO "ProcessedEvent" ("id", "eventId", "eventType", "processedAt")
      VALUES (${randomUUID()}, ${envelope.eventId}, ${envelope.eventType}, ${new Date()})
    `;

    if (isNew) {
      await this.publishAuditEvent(envelope, {
        action: 'CREATE', entity: 'User', entityId: userId,
        summary: 'Default tenant admin created',
        metadata: { email: envelope.payload.primaryContactEmail, tenantId: envelope.tenantId },
        module: 'iam',
        after: { email: envelope.payload.primaryContactEmail, status: 'PENDING_RESET' },
      });
    }

    if (!existingUserRoles[0] && userRoleId) {
      await this.publishAuditEvent(envelope, {
        action: 'ASSIGN_ROLE', entity: 'UserRole', entityId: userRoleId,
        summary: 'SCHOOL_ADMIN role assigned to tenant admin',
        metadata: { userId, roleCode: role.code },
        module: 'iam',
      });
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Private helpers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async writeLoginAudit(params: {
    tenantId: string;
    userId: string | null;
    loginIdentifier: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    failReason: string | null;
  }): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "LoginAudit" (
          "id", "tenantId", "userId", "loginIdentifier",
          "success", "ipAddress", "userAgent", "failReason", "createdAt"
        )
        VALUES (
          ${randomUUID()}, ${params.tenantId}, ${params.userId ?? null},
          ${params.loginIdentifier}, ${params.success},
          ${params.ipAddress ?? null}, ${params.userAgent ?? null},
          ${params.failReason ?? null}, ${new Date()}
        )
      `;
    } catch {
      // Non-fatal â€” audit failure must not block authentication.
    }
  }

  private async publishAuditEvent(
    sourceEnvelope: EventEnvelope<unknown>,
    payload: AuditEventRequestedPayload,
  ): Promise<void> {
    const auditEnvelope: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId: sourceEnvelope.tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: sourceEnvelope.correlationId,
      producer: { service: 'iam-service' },
      actor: sourceEnvelope.actor,
      payload,
    };
    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, auditEnvelope);
  }

  /** Seeds platform-scoped roles, permissions, and the PLATFORM_ADMIN super-user. */
  private async ensurePermissionModel(): Promise<void> {
    // RISK-02 fix: all system roles use tenantId = 'platform'.
    const systemRoles = [
      { code: 'PLATFORM_ADMIN', name: 'Platform Administrator',         description: 'Full platform access' },
      { code: 'SCHOOL_ADMIN',   name: 'School Administrator',           description: 'Default admin role for tenant onboarding' },
      { code: 'TEACHER',        name: 'Teacher',                        description: 'Teacher role with limited access' },
      { code: 'PARENT',         name: 'Parent',                         description: 'Parent role with portal-only access' },
    ];

    for (const r of systemRoles) {
      await this.prisma.$executeRaw`
        INSERT INTO "Role" (
          "id", "tenantId", "code", "name", "description",
          "isSystem", "softDelete", "version", "createdAt", "updatedAt"
        )
        VALUES (
          ${randomUUID()}, 'platform', ${r.code}, ${r.name}, ${r.description},
          true, false, 1, ${new Date()}, ${new Date()}
        )
        ON CONFLICT ("tenantId", "code") DO NOTHING
      `;
    }

    // Seed permissions (globally unique by code; R-05 fix: moduleKey populated).
    for (const permission of PERMISSIONS) {
      const moduleKey = PERMISSION_MODULE[permission] ?? 'system';
      await this.prisma.$executeRaw`
        INSERT INTO "Permission" ("id", "code", "name", "moduleKey", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${permission}, ${permission}, ${moduleKey}, ${new Date()}, ${new Date()})
        ON CONFLICT ("code") DO NOTHING
      `;
    }

    // Get platform role IDs.
    const platformAdminRole = await this.getSystemRoleId('PLATFORM_ADMIN');
    const schoolAdminRole   = await this.getSystemRoleId('SCHOOL_ADMIN');
    const teacherRole       = await this.getSystemRoleId('TEACHER');
    const parentRole        = await this.getSystemRoleId('PARENT');

    if (platformAdminRole) await this.assignRolePermissions(platformAdminRole, 'platform', [...PERMISSIONS]);
    if (schoolAdminRole) await this.assignRolePermissions(schoolAdminRole, 'platform', [
      'USER_CREATE', 'ROLE_ASSIGN', 'MODULE_ENABLE', 'MODULE_DISABLE',
      'ACADEMIC_YEAR_CREATE', 'CLASS_CREATE', 'SECTION_CREATE', 'SUBJECT_CREATE',
      'STUDENT_CREATE', 'TEACHER_ASSIGN', 'ATTENDANCE_SESSION_CREATE',
      'ATTENDANCE_MARK', 'ATTENDANCE_VIEW', 'EXAM_CREATE', 'EXAM_SUBJECT_ADD',
      'MARKS_ENTER', 'EXAM_VERIFY', 'EXAM_PUBLISH', 'RESULT_VIEW', 'ANALYTICS_VIEW',
    ]);
    if (teacherRole) await this.assignRolePermissions(teacherRole, 'platform', [
      'ATTENDANCE_SESSION_CREATE', 'ATTENDANCE_MARK', 'ATTENDANCE_VIEW',
      'MARKS_ENTER', 'RESULT_VIEW', 'ANALYTICS_VIEW',
    ]);
    if (parentRole) await this.assignRolePermissions(parentRole, 'platform', ['PORTAL_VIEW']);

    // Ensure platform super-user.
    const platformEmail  = this.configService.get<string>('PLATFORM_ADMIN_EMAIL') ?? 'platform.admin@sme.test';
    const platformAdminHash = createHash('sha256').update(`${platformEmail}:platform`).digest('hex');

    const existingAdmin = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "User"
      WHERE "tenantId" = 'platform' AND "email" = ${platformEmail}
      LIMIT 1
    `;

    let platformUserId: string;
    if (existingAdmin[0]) {
      platformUserId = existingAdmin[0].id;
    } else {
      platformUserId = randomUUID();
      await this.prisma.$executeRaw`
        INSERT INTO "User" (
          "id", "tenantId", "email", "displayName", "passwordHash",
          "status", "softDelete", "version", "createdAt", "updatedAt"
        )
        VALUES (
          ${platformUserId}, 'platform', ${platformEmail}, 'Platform Admin',
          ${platformAdminHash}, 'ACTIVE', false, 1, ${new Date()}, ${new Date()}
        )
        ON CONFLICT ("tenantId", "email") DO NOTHING
      `;
    }

    if (!platformAdminRole) return;

    await this.prisma.$executeRaw`
      INSERT INTO "UserRole" ("id", "tenantId", "userId", "roleId", "createdAt")
      VALUES (${randomUUID()}, 'platform', ${platformUserId}, ${platformAdminRole}, ${new Date()})
      ON CONFLICT ("tenantId", "userId", "roleId") DO NOTHING
    `;
  }

  private async getSystemRoleId(code: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Role"
      WHERE "tenantId" = 'platform' AND "code" = ${code}
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }

  /**
   * Assigns permissions to a role within a given tenant scope.
   * Accepts a roleId (not code) for precision â€” avoids re-fetch in hot path.
   * RISK-02 fix: RolePermission INSERT includes tenantId; conflict key is (tenantId, roleId, permissionId).
   */
  private async assignRolePermissions(
    roleId: string,
    tenantId: string,
    permissions: readonly string[],
  ): Promise<void> {
    for (const permissionCode of permissions) {
      const permissionRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Permission"
        WHERE "code" = ${permissionCode}
        LIMIT 1
      `;
      const permissionId = permissionRows[0]?.id;
      if (!permissionId) continue;

      await this.prisma.$executeRaw`
        INSERT INTO "RolePermission" ("id", "tenantId", "roleId", "permissionId", "createdAt")
        VALUES (${randomUUID()}, ${tenantId}, ${roleId}, ${permissionId}, ${new Date()})
        ON CONFLICT ("tenantId", "roleId", "permissionId") DO NOTHING
      `;
    }
  }
}
