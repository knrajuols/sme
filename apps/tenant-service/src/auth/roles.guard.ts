import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '@sme/auth';

import { ROLES_KEY } from './roles.decorator';

/**
 * RolesGuard — enforces role-based access control on individual routes.
 *
 * Design principles (Defense-in-Depth):
 *
 * 1. Default-deny: if no @Roles decorator is present on the handler OR its
 *    parent class, access is DENIED.  A route with no role contract is an
 *    implicit security hole.
 *
 * 2. Method-wins: getAllAndOverride checks the method handler first, then falls
 *    back to the class decorator.  A method-level @Roles always overrides the
 *    class-level default.
 *
 * 3. Mathematically correct intersection: uses Array.prototype.some + includes
 *    (O(n·m) but n is always small for roles arrays) — no set tricks needed.
 *
 * 4. This guard must run AFTER JwtAuthGuard so that request.user is populated.
 *    Attach it via @UseGuards(RolesGuard) at the controller or module level.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Default-deny: no @Roles metadata anywhere → reject unconditionally.
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException({
        message: 'Access denied: this route has no role policy configured.',
        code: 'ROLES_NOT_CONFIGURED',
      });
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRoles: string[] = request.user?.roles ?? [];

    // PLATFORM_ADMIN is a super-role: bypass all tenant-level role checks.
    if (userRoles.includes('PLATFORM_ADMIN')) {
      return true;
    }

    // Accept if the user has at least one of the required roles.
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException({
        message: `Access denied: requires one of [${requiredRoles.join(', ')}].`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    return true;
  }
}
