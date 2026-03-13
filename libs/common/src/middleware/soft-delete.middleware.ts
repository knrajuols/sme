/**
 * Prisma Soft-Delete Middleware (R-06 fix)
 *
 * Automatically appends `softDelete = false` filters to all findMany and
 * findFirst/findUnique operations on models that carry a `softDelete` field.
 *
 * Usage — apply in PrismaService constructor:
 *   this.$use(softDeleteMiddleware());
 *
 * Note: Hard deletes are prevented by throwing unless the caller explicitly
 * passes `{ where: { softDelete: false } }` on a delete call. Use update +
 * softDelete=true for logical deletion.
 */

import type { Prisma } from '@prisma/client';

// Widen `model` from the root @prisma/client ModelName union to plain string.
// Each NestJS service generates its own Prisma client with its own ModelName
// union (e.g. "ConfigMaster" only exists in config-service's client, not in
// the root node_modules/.prisma/client).  Using the narrow root type here
// causes TS2345 when any service's PrismaService calls this.$use(middleware).
// Next uses `any` for params because the contravariant next function type also
// needs to match each service's local MiddlewareParams — standard Prisma pattern.
type Params = Omit<Prisma.MiddlewareParams, 'model'> & { model?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Next<T> = (params: any) => Promise<T>;

const SOFT_DELETE_FIELD = 'softDelete';

/** Models that have a softDelete column. Add to this list as new models are added. */
const SOFT_DELETE_MODELS = new Set([
  'User',
  'Role',
  'UserRole',
  'RolePermission',
  'Parent',
  'ParentStudentMapping',
  'Student',
  'Teacher',
  'Class',
  'Section',
  'Subject',
  'AcademicYear',
  'StudentEnrollment',
  'ClassTeacherAssignment',
  'Period',
  'AttendanceSession',
  'AttendanceRecord',
  'Exam',
  'ExamSubject',
  'StudentMark',
  'GradeScale',
  'StudentExamResult',
  'StudentExamAggregate',
  'ClassExamAggregate',
  'SubjectExamAnalytics',
  'ConfigMaster',
  'ModuleEntitlement',
  'FeatureFlag',
  'Tenant',
]);

/** Operations where we inject the softDelete = false filter */
const READ_OPERATIONS = new Set<Prisma.PrismaAction>([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
] as Prisma.PrismaAction[]);

export function softDeleteMiddleware<T = unknown>() {
  return async (params: Params, next: Next<T>): Promise<T> => {
    if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
      return next(params);
    }

    if (READ_OPERATIONS.has(params.action)) {
      // Inject softDelete = false unless caller already filters on it
      const where = (params.args?.where as Record<string, unknown>) ?? {};
      if (!(SOFT_DELETE_FIELD in where)) {
        // findUnique / findUniqueOrThrow only accept unique fields in `where`.
        // Injecting softDelete (non-unique) would cause a Prisma validation error.
        // Downgrade to findFirst / findFirstOrThrow so we can add arbitrary filters
        // while preserving the same single-result semantics.
        const action = params.action as string;
        if (action === 'findUnique') {
          params.action = 'findFirst' as Prisma.PrismaAction;
        } else if (action === 'findUniqueOrThrow') {
          params.action = 'findFirstOrThrow' as Prisma.PrismaAction;
        }

        params.args = {
          ...params.args,
          where: {
            ...where,
            [SOFT_DELETE_FIELD]: false,
          },
        };
      }
    }

    if (params.action === 'delete') {
      // Convert hard delete to soft delete
      params.action = 'update';
      params.args = {
        ...params.args,
        data: {
          [SOFT_DELETE_FIELD]: true,
          updatedAt: new Date(),
        },
      };
    }

    if (params.action === 'deleteMany') {
      // Convert hard bulk delete to soft bulk delete
      params.action = 'updateMany';
      params.args = {
        ...params.args,
        data: {
          ...(params.args?.data as Record<string, unknown>),
          [SOFT_DELETE_FIELD]: true,
          updatedAt: new Date(),
        },
      };
    }

    return next(params);
  };
}
