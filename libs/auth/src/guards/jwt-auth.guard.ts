import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../interfaces/request-context.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtTokenService } from '../services/jwt-token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const routePath = request.path ?? request.url ?? '';
    const isInternalRoute = routePath.startsWith('/internal/');

    if (isInternalRoute) {
      const providedSecret = this.getHeaderValue(request, 'x-internal-secret');
      const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;

      if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
        throw new UnauthorizedException('Invalid or missing internal service secret');
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic && !isInternalRoute) {
      return true;
    }

    const authorization = this.getHeaderValue(request, 'authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const claims = this.jwtTokenService.verifyToken(token);

    const requestedTenantId = this.getHeaderValue(request, 'x-tenant-id');
    const isPlatformAdmin = claims.roles.includes('PLATFORM_ADMIN');
    const resolvedTenantId = isPlatformAdmin && requestedTenantId ? requestedTenantId : claims.tenantId;

    request.user = claims;
    request.tenantId = resolvedTenantId;
    request.impersonatedTenantId = isPlatformAdmin && requestedTenantId ? requestedTenantId : undefined;

    return true;
  }

  private getHeaderValue(request: AuthenticatedRequest, name: string): string | undefined {
    const value = request.headers[name] ?? request.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' ? value : undefined;
  }
}