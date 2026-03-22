import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';
import {
  CreateTransportAllocationDto,
  UpdateTransportAllocationDto,
} from './dto/transport-allocation.dto';

interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  correlationId: string;
}

@Injectable()
export class TransportAllocationService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  STUDENTS GRID (all students with allocation status)  ═════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async getStudentsGrid(tenantId: string) {
    return this.prisma.student.findMany({
      where: { tenantId, softDelete: false, status: 'ACTIVE' },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        enrollments: {
          where: { softDelete: false },
          select: {
            rollNumber: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
            academicYear: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
        transportAllocations: {
          where: { softDelete: false, isActive: true },
          select: {
            id: true,
            routeId: true,
            route: { select: { code: true, name: true } },
            pickupTripId: true,
            pickupStopId: true,
            pickupStop: {
              select: { stop: { select: { name: true } } },
            },
            dropTripId: true,
            dropStopId: true,
            dropStop: {
              select: { stop: { select: { name: true } } },
            },
            academicYearId: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
      },
      orderBy: [{ firstName: 'asc' }],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  LIST ALLOCATIONS  ════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listAllocations(tenantId: string) {
    return this.prisma.transportAllocation.findMany({
      where: { tenantId, softDelete: false },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        academicYear: { select: { id: true, name: true } },
        route: { select: { id: true, code: true, name: true } },
        pickupTrip: { select: { id: true, tripType: true, startTime: true, endTime: true } },
        pickupStop: {
          select: { id: true, sequence: true, pickupTime: true, stop: { select: { name: true } } },
        },
        dropTrip: { select: { id: true, tripType: true, startTime: true, endTime: true } },
        dropStop: {
          select: { id: true, sequence: true, dropTime: true, stop: { select: { name: true } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  CREATE ALLOCATION (with Capacity Validation)  ════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async createAllocation(
    dto: CreateTransportAllocationDto,
    ctx: RequestContext,
  ): Promise<{ id: string }> {
    // 1. Service-level rule: only ONE active allocation per student per academic year
    const existing = await this.prisma.transportAllocation.findFirst({
      where: {
        tenantId: ctx.tenantId,
        studentId: dto.studentId,
        academicYearId: dto.academicYearId,
        isActive: true,
        softDelete: false,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'This student already has an active transport allocation. Please revoke the current allocation before assigning a new route.',
      );
    }

    // 2. Capacity validation — pickup trip
    await this.validateTripCapacity(dto.pickupTripId, null);

    // 3. Capacity validation — drop trip (only if different from pickup)
    if (dto.dropTripId !== dto.pickupTripId) {
      await this.validateTripCapacity(dto.dropTripId, null);
    }

    const { id } = await this.prisma.transportAllocation.create({
      data: {
        tenantId: ctx.tenantId,
        studentId: dto.studentId,
        academicYearId: dto.academicYearId,
        routeId: dto.routeId,
        pickupTripId: dto.pickupTripId,
        pickupStopId: dto.pickupStopId,
        dropTripId: dto.dropTripId,
        dropStopId: dto.dropStopId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      select: { id: true },
    });
    return { id };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  UPDATE ALLOCATION  ═══════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async updateAllocation(
    id: string,
    dto: UpdateTransportAllocationDto,
    ctx: RequestContext,
  ): Promise<{ id: string }> {
    const alloc = await this.prisma.transportAllocation.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!alloc) throw new NotFoundException('Transport allocation not found.');

    // Capacity validation if trip is changing
    const newPickupTripId = dto.pickupTripId ?? alloc.pickupTripId;
    const newDropTripId = dto.dropTripId ?? alloc.dropTripId;

    if (dto.pickupTripId && dto.pickupTripId !== alloc.pickupTripId) {
      await this.validateTripCapacity(dto.pickupTripId, id);
    }
    if (dto.dropTripId && dto.dropTripId !== alloc.dropTripId) {
      if (newDropTripId !== newPickupTripId || !dto.pickupTripId) {
        await this.validateTripCapacity(dto.dropTripId, id);
      }
    }

    await this.prisma.transportAllocation.update({
      where: { id },
      data: {
        ...(dto.routeId !== undefined && { routeId: dto.routeId }),
        ...(dto.pickupTripId !== undefined && { pickupTripId: dto.pickupTripId }),
        ...(dto.pickupStopId !== undefined && { pickupStopId: dto.pickupStopId }),
        ...(dto.dropTripId !== undefined && { dropTripId: dto.dropTripId }),
        ...(dto.dropStopId !== undefined && { dropStopId: dto.dropStopId }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedBy: ctx.userId,
      },
    });
    return { id };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  REVOKE (soft-delete) ═════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async revokeAllocation(id: string, ctx: RequestContext): Promise<{ id: string }> {
    const alloc = await this.prisma.transportAllocation.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!alloc) throw new NotFoundException('Transport allocation not found.');

    await this.prisma.transportAllocation.update({
      where: { id },
      data: { isActive: false, endDate: new Date(), updatedBy: ctx.userId },
    });
    return { id };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  HELPER: SEARCH STUDENTS  ════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async searchStudents(tenantId: string, q: string) {
    const where: Record<string, unknown> = {
      tenantId,
      softDelete: false,
      status: 'ACTIVE',
    };
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { admissionNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.student.findMany({
      where: where as any,
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        status: true,
        enrollments: {
          where: { softDelete: false },
          select: {
            class: { select: { name: true } },
            section: { select: { name: true } },
            academicYear: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
      },
      orderBy: [{ firstName: 'asc' }],
      take: 50,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  HELPER: LOOKUP DATA (routes, trips, stops, academic years)  ══════════
  // ═══════════════════════════════════════════════════════════════════════════

  async getLookupData(tenantId: string) {
    const [routes, academicYears] = await Promise.all([
      this.prisma.transportRoute.findMany({
        where: { tenantId, softDelete: false, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          trips: {
            where: { softDelete: false },
            select: {
              id: true,
              tripType: true,
              startTime: true,
              endTime: true,
              vehicleId: true,
              vehicle: { select: { capacity: true, registrationNo: true } },
            },
          },
          stops: {
            where: { softDelete: false },
            select: {
              id: true,
              sequence: true,
              pickupTime: true,
              dropTime: true,
              stop: { select: { id: true, name: true } },
            },
            orderBy: { sequence: 'asc' },
          },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.academicYear.findMany({
        where: { tenantId, softDelete: false },
        select: { id: true, name: true, isActive: true },
        orderBy: { startDate: 'desc' },
      }),
    ]);
    return { routes, academicYears };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  PRIVATE: Capacity Validation  ════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates that the vehicle assigned to a trip has not exceeded its capacity.
   * @param tripId  — The RouteTrip being allocated
   * @param excludeAllocationId — Exclude this allocation from count (for updates)
   */
  private async validateTripCapacity(
    tripId: string,
    excludeAllocationId: string | null,
  ): Promise<void> {
    const trip = await this.prisma.routeTrip.findUnique({
      where: { id: tripId },
      select: { vehicleId: true, vehicle: { select: { capacity: true, registrationNo: true } } },
    });

    if (!trip) {
      throw new BadRequestException('The selected trip does not exist.');
    }

    // If no vehicle is assigned to the trip, block allocation
    if (!trip.vehicleId || !trip.vehicle) {
      throw new BadRequestException(
        'Capacity Error: The selected trip does not have a vehicle assigned. Please assign a vehicle in the Route Master first.',
      );
    }

    const capacity = trip.vehicle.capacity;

    const countWhere: Record<string, unknown> = {
      softDelete: false,
      isActive: true,
      OR: [
        { pickupTripId: tripId },
        { dropTripId: tripId },
      ],
    };
    if (excludeAllocationId) {
      countWhere.id = { not: excludeAllocationId };
    }

    const activeCount = await this.prisma.transportAllocation.count({
      where: countWhere as any,
    });

    if (activeCount >= capacity) {
      throw new BadRequestException(
        `Capacity Error: Vehicle ${trip.vehicle.registrationNo} on this trip is fully booked (${activeCount}/${capacity} seats allocated).`,
      );
    }
  }
}
