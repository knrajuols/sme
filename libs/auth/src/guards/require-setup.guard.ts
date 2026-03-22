/**
 * require-setup.guard.ts — Enforces password reset at the API layer.
 * ──────────────────────────────────────────────────────────────────────────────
 * [SEC-AUTH-GUARD-001] If the JWT claims contain requiresPasswordChange: true,
 * this guard throws a 403 ForbiddenException so that NO protected endpoint can
 * be accessed until the staff member changes their default password.
 *
 * Endpoints decorated with @SkipSetupGuard() (e.g. change-password) are exempt.
 * Public endpoints (marked with @Public()) are also unaffected because JwtAuthGuard
 * lets them through before this guard runs.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

import type { AuthenticatedRequest } from '@sme/auth';
import { IS_PUBLIC_KEY } from '@sme/auth';

// ── Decorator: Mark an endpoint as exempt from the setup guard ──────────────
export const SKIP_SETUP_GUARD_KEY = 'skipSetupGuard';
export const SkipSetupGuard = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_SETUP_GUARD_KEY, true);

@Injectable()
export class RequireSetupGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for @Public() routes — they have no JWT claims.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Skip for routes explicitly exempted with @SkipSetupGuard().
    const skipSetup = this.reflector.getAllAndOverride<boolean>(SKIP_SETUP_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipSetup) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const claims = request.user;

    // No claims means JwtAuthGuard already rejected — nothing to do.
    if (!claims) return true;

    if (claims.requiresPasswordChange === true) {
      throw new ForbiddenException('Password reset required');
    }

    return true;
  }
}
