import { ConflictException } from '@nestjs/common';

/**
 * Optimistic Lock Helper (R-02 fix)
 *
 * Provides a consistent pattern for optimistic concurrency control using a
 * `version` column that is incremented on every UPDATE.
 *
 * Usage in a service:
 *   const updated = await OptimisticLock.updateWithVersion(
 *     prisma.student,
 *     { id: studentId, tenantId },
 *     { firstName: 'Alice' },
 *     expectedVersion,
 *   );
 *
 * If another process has already incremented the version, a ConflictException
 * with code RESOURCE_CONFLICT is thrown.
 */

export interface VersionedRecord {
  version: number;
}

export interface PrismaModelDelegate {
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
}

export class OptimisticLock {
  /**
   * Performs an optimistic-lock update.
   *
   * @param model   - Prisma model delegate (e.g. `prisma.student`)
   * @param where   - Primary key scope (must include `id` and `tenantId`)
   * @param data    - Fields to update (version and updatedAt are auto-managed)
   * @param currentVersion - The version the caller read before starting the update
   */
  static async updateWithVersion(
    model: PrismaModelDelegate,
    where: { id: string; tenantId: string } & Record<string, unknown>,
    data: Record<string, unknown>,
    currentVersion: number,
  ): Promise<void> {
    const result = await model.updateMany({
      where: {
        ...where,
        version: currentVersion,
        softDelete: false,
      },
      data: {
        ...data,
        version: currentVersion + 1,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new ConflictException({
        type: 'https://sme.example.com/errors/resource-conflict',
        title: 'Optimistic Lock Conflict',
        status: 409,
        detail:
          'The record was modified by another process. Please refresh and retry.',
        code: 'RESOURCE_CONFLICT',
      });
    }
  }
}
