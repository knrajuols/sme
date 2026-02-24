import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

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

  async createUser(
    dto: CreateUserDto,
    tenantId: string,
  ): Promise<{ created: boolean; user: CreateUserDto & { tenantId: string } }> {
    await this.prisma.$executeRaw`
      INSERT INTO "User" ("id", "email", "fullName", "tenantId", "isActive", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${dto.email}, ${dto.fullName}, ${tenantId}, true, ${new Date()}, ${new Date()})
      ON CONFLICT ("email") DO UPDATE SET
        "fullName" = EXCLUDED."fullName",
        "tenantId" = EXCLUDED."tenantId",
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    return {
      created: true,
      user: {
        ...dto,
        tenantId,
      },
    };
  }

  async listUsers(tenantId: string): Promise<Array<{ id: string; email: string; fullName: string; tenantId: string | null }>> {
    const users = await this.prisma.$queryRaw<Array<{ id: string; email: string; fullName: string; tenantId: string | null }>>`
      SELECT "id", "email", "fullName", "tenantId"
      FROM "User"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "createdAt" ASC
    `;

    return users;
  }

  async issueAccessToken(
    dto: AuthTokenRequestDto,
  ): Promise<{ accessToken: string; expiresIn: number; claims: JwtClaims }> {
    const users = await this.prisma.$queryRaw<Array<{ id: string; email: string; tenantId: string | null }>>`
      SELECT "id", "email", "tenantId"
      FROM "User"
      WHERE "email" = ${dto.email}
      LIMIT 1
    `;

    const user = users[0];
    if (!user) {
      throw new NotFoundException('User not found');
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

    const tenantId = roles.includes('PLATFORM_ADMIN') ? 'platform' : user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('User tenant context is missing');
    }

    const expiresIn = Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? '3600');
    const sessionId = randomUUID();
    const accessToken = this.jwtTokenService.issueToken({
      sub: user.id,
      tenantId,
      roles,
      permissions: permissionRows.map((item) => item.code),
      sessionId,
      expiresInSeconds: expiresIn,
    });

    const claims = this.jwtTokenService.verifyToken(accessToken);

    return {
      accessToken,
      expiresIn,
      claims,
    };
  }

  async assignRole(
    userId: string,
    roleCode: string,
    actor: JwtClaims,
  ): Promise<{ assigned: boolean; userId: string; roleCode: string }> {
    const userRows = await this.prisma.$queryRaw<Array<{ id: string; tenantId: string | null }>>`
      SELECT "id", "tenantId"
      FROM "User"
      WHERE "id" = ${userId}
      LIMIT 1
    `;

    const targetUser = userRows[0];
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const isPlatformAdmin = actor.roles.includes('PLATFORM_ADMIN');
    if (!isPlatformAdmin && targetUser.tenantId !== actor.tenantId) {
      throw new ForbiddenException({
        message: 'Cross-tenant role assignment is forbidden',
        code: 'TENANT_SCOPE_VIOLATION',
      });
    }

    const roleRows = await this.prisma.$queryRaw<Array<{ id: string; code: string }>>`
      SELECT "id", "code"
      FROM "Role"
      WHERE "code" = ${roleCode}
      LIMIT 1
    `;

    const role = roleRows[0];
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.prisma.$executeRaw`
      INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
      VALUES (${randomUUID()}, ${targetUser.id}, ${role.id}, ${new Date()})
      ON CONFLICT ("userId", "roleId") DO NOTHING
    `;

    await this.publishAuditEvent(
      {
        eventId: randomUUID(),
        eventType: 'iam.RoleAssigned',
        eventVersion: '1.0.0',
        tenantId: targetUser.tenantId ?? actor.tenantId,
        occurredAt: new Date().toISOString(),
        correlationId: randomUUID(),
        producer: { service: 'iam-service' },
        actor: {
          actorType: 'USER',
          actorId: actor.sub,
          role: actor.roles[0] ?? 'USER',
        },
        payload: {
          tenantId: targetUser.tenantId ?? actor.tenantId,
          tenantCode: targetUser.tenantId ?? actor.tenantId,
          schoolName: 'n/a',
          status: 'n/a',
          primaryContactName: 'n/a',
          primaryContactEmail: 'n/a',
          primaryContactPhone: 'n/a',
        },
      },
      {
        action: 'ASSIGN_ROLE',
        entity: 'UserRole',
        entityId: `${targetUser.id}:${role.code}`,
        summary: 'Role assigned to user',
        metadata: {
          userId: targetUser.id,
          roleCode: role.code,
        },
      },
    );

    return {
      assigned: true,
      userId: targetUser.id,
      roleCode: role.code,
    };
  }

  async handleTenantCreatedEvent(
    envelope: EventEnvelope<TenantCreatedPayload>,
  ): Promise<void> {
    const alreadyProcessed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ProcessedEvent"
      WHERE "eventId" = ${envelope.eventId}
      LIMIT 1
    `;

    if (alreadyProcessed.length > 0) {
      return;
    }

    await this.prisma.$executeRaw`
      INSERT INTO "Role" ("id", "code", "name", "description", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, 'SCHOOL_ADMIN', 'School Administrator', 'Default admin role for tenant onboarding', ${new Date()}, ${new Date()})
      ON CONFLICT ("code") DO NOTHING
    `;

    const roleRows = await this.prisma.$queryRaw<Array<{ id: string; code: string }>>`
      SELECT "id", "code"
      FROM "Role"
      WHERE "code" = 'SCHOOL_ADMIN'
      LIMIT 1
    `;

    const role = roleRows[0];

    const existingUsers = await this.prisma.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT "id", "email"
      FROM "User"
      WHERE "email" = ${envelope.payload.primaryContactEmail}
      LIMIT 1
    `;

    const existingUser = existingUsers[0];

    let user = existingUser
      ? {
          id: existingUser.id,
          email: existingUser.email,
        }
      : null;

    if (!user) {
      const createdUserId = randomUUID();
      await this.prisma.$executeRaw`
        INSERT INTO "User" ("id", "email", "fullName", "tenantId", "isActive", "createdAt", "updatedAt")
        VALUES (${createdUserId}, ${envelope.payload.primaryContactEmail}, ${envelope.payload.primaryContactName}, ${envelope.tenantId}, true, ${new Date()}, ${new Date()})
      `;

      user = {
        id: createdUserId,
        email: envelope.payload.primaryContactEmail,
      };
    }

    const existingUserRoles = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "UserRole"
      WHERE "userId" = ${user.id} AND "roleId" = ${role.id}
      LIMIT 1
    `;

    const existingUserRole = existingUserRoles[0];

    let roleAssigned = existingUserRole ? { id: existingUserRole.id } : null;

    if (!roleAssigned) {
      const userRoleId = randomUUID();
      await this.prisma.$executeRaw`
        INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
        VALUES (${userRoleId}, ${user.id}, ${role.id}, ${new Date()})
      `;
      roleAssigned = { id: userRoleId };
    }

    await this.prisma.$executeRaw`
      INSERT INTO "ProcessedEvent" ("id", "eventId", "eventType", "processedAt")
      VALUES (${randomUUID()}, ${envelope.eventId}, ${envelope.eventType}, ${new Date()})
    `;

    if (!existingUser) {
      await this.publishAuditEvent(envelope, {
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        summary: 'Default tenant admin created',
        metadata: {
          email: user.email,
          tenantId: envelope.tenantId,
        },
      });
    }

    if (!existingUserRole && roleAssigned) {
      await this.publishAuditEvent(envelope, {
        action: 'ASSIGN_ROLE',
        entity: 'UserRole',
        entityId: roleAssigned.id,
        summary: 'SCHOOL_ADMIN role assigned to tenant admin',
        metadata: {
          userId: user.id,
          roleCode: role.code,
        },
      });
    }
  }

  private async publishAuditEvent(
    sourceEnvelope: EventEnvelope<TenantCreatedPayload>,
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

  private async ensurePermissionModel(): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "Role" ("id", "code", "name", "description", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}, 'PLATFORM_ADMIN', 'Platform Administrator', 'Full platform access', ${new Date()}, ${new Date()}),
        (${randomUUID()}, 'SCHOOL_ADMIN', 'School Administrator', 'Default admin role for tenant onboarding', ${new Date()}, ${new Date()}),
        (${randomUUID()}, 'TEACHER', 'Teacher', 'Teacher role with limited access', ${new Date()}, ${new Date()}),
        (${randomUUID()}, 'PARENT', 'Parent', 'Parent role with portal-only access', ${new Date()}, ${new Date()})
      ON CONFLICT ("code") DO NOTHING
    `;

    for (const permission of PERMISSIONS) {
      await this.prisma.$executeRaw`
        INSERT INTO "Permission" ("id", "code", "name", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${permission}, ${permission}, ${new Date()}, ${new Date()})
        ON CONFLICT ("code") DO NOTHING
      `;
    }

    await this.assignRolePermissions('PLATFORM_ADMIN', [...PERMISSIONS]);
    await this.assignRolePermissions('SCHOOL_ADMIN', [
      'USER_CREATE',
      'ROLE_ASSIGN',
      'MODULE_ENABLE',
      'MODULE_DISABLE',
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
    ]);
    await this.assignRolePermissions('TEACHER', [
      'ATTENDANCE_SESSION_CREATE',
      'ATTENDANCE_MARK',
      'ATTENDANCE_VIEW',
      'MARKS_ENTER',
      'RESULT_VIEW',
      'ANALYTICS_VIEW',
    ]);
    await this.assignRolePermissions('PARENT', [
      'PORTAL_VIEW',
    ]);

    const platformUserEmail = this.configService.get<string>('PLATFORM_ADMIN_EMAIL') ?? 'platform.admin@sme.local';
    const platformUserRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "User"
      WHERE "email" = ${platformUserEmail}
      LIMIT 1
    `;

    const platformUserId = platformUserRows[0]?.id ?? randomUUID();

    if (!platformUserRows[0]) {
      await this.prisma.$executeRaw`
        INSERT INTO "User" ("id", "email", "fullName", "tenantId", "isActive", "createdAt", "updatedAt")
        VALUES (${platformUserId}, ${platformUserEmail}, 'Platform Admin', 'platform', true, ${new Date()}, ${new Date()})
      `;
    }

    const platformRoleRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Role"
      WHERE "code" = 'PLATFORM_ADMIN'
      LIMIT 1
    `;

    const platformRoleId = platformRoleRows[0]?.id;
    if (!platformRoleId) {
      return;
    }

    await this.prisma.$executeRaw`
      INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
      VALUES (${randomUUID()}, ${platformUserId}, ${platformRoleId}, ${new Date()})
      ON CONFLICT ("userId", "roleId") DO NOTHING
    `;
  }

  private async assignRolePermissions(roleCode: string, permissions: string[]): Promise<void> {
    const roleRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Role"
      WHERE "code" = ${roleCode}
      LIMIT 1
    `;

    const roleId = roleRows[0]?.id;
    if (!roleId) {
      return;
    }

    await this.prisma.$executeRaw`
      DELETE FROM "RolePermission"
      WHERE "roleId" = ${roleId}
    `;

    for (const permissionCode of permissions) {
      const permissionRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Permission"
        WHERE "code" = ${permissionCode}
        LIMIT 1
      `;

      const permissionId = permissionRows[0]?.id;
      if (!permissionId) {
        continue;
      }

      await this.prisma.$executeRaw`
        INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
        VALUES (${randomUUID()}, ${roleId}, ${permissionId}, ${new Date()})
        ON CONFLICT ("roleId", "permissionId") DO NOTHING
      `;
    }
  }
}
