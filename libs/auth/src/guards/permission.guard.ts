import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'crypto';

import type { AuditEventRequestedPayload, EventEnvelope } from '@sme/common';
import { AUDIT_EVENT_REQUESTED_ROUTING_KEY } from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';

import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../interfaces/request-context.interface';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly publisher: MessagePublisherService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const claims = request.user;

    if (!claims) {
      throw new ForbiddenException({
        message: 'Missing authenticated user context',
        code: 'PERMISSION_DENIED',
      });
    }

    if (claims.roles.includes('PLATFORM_ADMIN')) {
      return true;
    }

    const userPermissions = new Set(claims.permissions ?? []);
    const missingPermission = requiredPermissions.find((permission) => !userPermissions.has(permission));

    if (missingPermission) {
      await this.publishPermissionDeniedAudit(request, missingPermission);
      throw new ForbiddenException({
        message: 'User lacks required permission',
        code: 'PERMISSION_DENIED',
        details: {
          missingPermission,
        },
      });
    }

    return true;
  }

  private async publishPermissionDeniedAudit(
    request: AuthenticatedRequest,
    missingPermission: string,
  ): Promise<void> {
    const claims = request.user;
    if (!claims) {
      return;
    }

    const correlationIdHeader = request.headers['x-correlation-id'];
    const correlationId =
      typeof correlationIdHeader === 'string' && correlationIdHeader.length > 0
        ? correlationIdHeader
        : randomUUID();

    const payload: AuditEventRequestedPayload = {
      action: 'PERMISSION_DENIED',
      entity: 'PermissionGuard',
      entityId: claims.sub,
      summary: 'Permission denied by service guard',
      metadata: {
        permission: missingPermission,
        path: request.path ?? request.url,
      },
    };

    const envelope: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId: request.tenantId ?? claims.tenantId,
      occurredAt: new Date().toISOString(),
      correlationId,
      producer: { service: 'security-guard' },
      actor: {
        actorType: 'USER',
        actorId: claims.sub,
        role: claims.roles[0] ?? 'USER',
      },
      payload,
    };

    try {
      await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, envelope);
    } catch {
      return;
    }
  }
}