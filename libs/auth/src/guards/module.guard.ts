import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../interfaces/request-context.interface';

/**
 * Module Enforcement Guard (RISK-07 fix)
 *
 * Reads the module entitlement status from ConfigClient and blocks requests to
 * module routes that are not enabled for the calling tenant.
 *
 * Platform routes (`/platform/*`, `/auth/*`, `/iam/*`, `/health*`) bypass this guard.
 * Only operates when the ConfigEnablementChecker has been wired.
 *
 * Usage: register as global guard in AppModule via APP_GUARD or apply via @UseGuards().
 * The gateway module is the primary consumer; individual services provide second-layer defense.
 *
 * The checker is injected via the MODULE_CHECKER_TOKEN InjectionToken so each app can
 * provide its own implementation (HTTP call to config-service or local cache).
 */

export const MODULE_CHECKER_TOKEN = Symbol('MODULE_CHECKER_TOKEN');

export interface ModuleEnablementChecker {
  isModuleEnabled(tenantId: string, moduleKey: string): Promise<boolean>;
}

/** Maps route path prefixes to module keys as defined in LLD-05 §5 */
const ROUTE_MODULE_MAP: Record<string, string> = {
  '/attendance': 'attendance',
  '/fees': 'fees',
  '/exam': 'exam',
  '/transport': 'transport',
  '/library': 'library',
  '/inventory': 'inventory',
  '/portal': 'portal',
  '/website': 'website',
  '/hr': 'hr',
};

/** Route prefixes that ALWAYS bypass module enforcement */
const BYPASS_PREFIXES = [
  '/platform',
  '/auth',
  '/iam',
  '/health',
  '/internal',
  '/onboarding',
  '/school',
  '/configurations',
  '/audit',
  '/students',
  '/academic',
  '/analytics',
  '/tenant',
];

@Injectable()
export class ModuleGuard implements CanActivate {
  private readonly logger = new Logger(ModuleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(MODULE_CHECKER_TOKEN) private readonly checker: ModuleEnablementChecker,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const path: string = request.path ?? request.url ?? '';
    const tenantId = request.tenantId ?? request.user?.tenantId;

    // Platform admin bypasses all module checks
    if (request.user?.roles?.includes('PLATFORM_ADMIN')) {
      return true;
    }

    // Bypass prefixes always pass
    if (BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return true;
    }

    if (!tenantId) {
      return true; // Guard only applies to authenticated tenant users
    }

    const moduleKey = Object.entries(ROUTE_MODULE_MAP).find(([prefix]) =>
      path.startsWith(prefix),
    )?.[1];

    if (!moduleKey) {
      return true; // Route not mapped to any module — allow
    }

    try {
      const enabled = await this.checker.isModuleEnabled(tenantId, moduleKey);
      if (!enabled) {
        throw new ForbiddenException({
          type: 'https://sme.example.com/errors/module-disabled',
          title: 'Module Not Enabled',
          status: 403,
          detail: `The '${moduleKey}' module is not enabled for your school.`,
          moduleKey,
          tenantId,
        });
      }
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      // If config service is unreachable, log and allow (fail-open for availability)
      this.logger.warn(
        `Module check failed for tenantId=${tenantId} moduleKey=${moduleKey}: ${String(error)}`,
      );
      return true;
    }
  }
}
