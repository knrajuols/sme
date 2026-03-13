import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by RolesGuard to retrieve the required roles for a route.
 */
export const ROLES_KEY = 'required_roles';

/**
 * Attach one or more required role strings to a controller class or individual
 * route handler.  RolesGuard inspects this metadata at request time.
 *
 * Usage:
 *   @Roles('SCHOOL_ADMIN')              // class-level default
 *   @Roles('SCHOOL_ADMIN', 'TEACHER')   // method-level override
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
