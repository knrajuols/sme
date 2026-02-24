import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../interfaces/request-context.interface';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const claims = request.user;

    if (!claims) {
      return true;
    }

    const routeTenantId = request.params?.tenantId;
    if (!routeTenantId) {
      return true;
    }

    if (claims.roles.includes('PLATFORM_ADMIN')) {
      return true;
    }

    const resolvedTenantId = request.tenantId ?? claims.tenantId;

    if (routeTenantId !== resolvedTenantId) {
      throw new ForbiddenException({
        message: 'Cross-tenant access is forbidden',
        code: 'TENANT_SCOPE_VIOLATION',
        details: {
          tenantId: resolvedTenantId,
          requestedTenantId: routeTenantId,
        },
      });
    }

    return true;
  }
}