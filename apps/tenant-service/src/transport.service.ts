import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from './prisma/prisma.service';
import { StaffAuthService } from './staff-auth.service';
import { TenantStatus } from './generated/prisma-client';
import {
  CreateDriverDto,
  UpdateDriverDto,
  CreateAttendantDto,
  UpdateAttendantDto,
  CreateVehicleDto,
  UpdateVehicleDto,
  CreateStopDto,
  UpdateStopDto,
  CreateRouteDto,
  UpdateRouteDto,
} from './dto/transport.dto';

interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  correlationId: string;
}

@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  DRIVERS  ═════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listDrivers(tenantId: string) {
    return this.prisma.driver.findMany({
      where: { tenantId, softDelete: false },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, contactPhone: true, email: true, dateOfBirth: true, dateOfJoining: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDriver(dto: CreateDriverDto, ctx: RequestContext): Promise<{ id: string }> {
    const driverId = randomUUID();
    const employeeId = randomUUID();

    // Hash DOB as default password (DDMMYYYY format)
    const passwordHash = await this.staffAuth.hashDateOfBirth(
      dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
    );

    // Atomic transaction: Employee backbone + Driver extension
    await this.prisma.$transaction(async (tx) => {
      // FIRST: Create the unified Employee record
      await tx.employee.create({
        data: {
          id: employeeId,
          tenantId: ctx.tenantId,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          contactPhone: dto.phone,
          email: dto.email ?? null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
          passwordHash,
          requiresPasswordChange: true,
          departmentId: dto.departmentId,
          roleId: dto.roleId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });

      // SECOND: Create the Driver extension linked to the Employee
      await tx.driver.create({
        data: {
          id: driverId,
          tenantId: ctx.tenantId,
          employeeId,
          licenseNumber: dto.licenseNumber,
          licenseExpiry: new Date(dto.licenseExpiry),
          badgeNumber: dto.badgeNumber ?? null,
          badgeExpiry: dto.badgeExpiry ? new Date(dto.badgeExpiry) : null,
          policeVerificationStatus: dto.policeVerificationStatus ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });
    });

    return { id: driverId };
  }

  async updateDriver(id: string, dto: UpdateDriverDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.driver.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
      select: { id: true, employeeId: true },
    });
    if (!existing) throw new NotFoundException('Driver not found');

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.licenseNumber !== undefined) data.licenseNumber = dto.licenseNumber;
    if (dto.licenseExpiry !== undefined) data.licenseExpiry = new Date(dto.licenseExpiry);
    if (dto.badgeNumber !== undefined) data.badgeNumber = dto.badgeNumber;
    if (dto.badgeExpiry !== undefined) data.badgeExpiry = dto.badgeExpiry ? new Date(dto.badgeExpiry) : null;
    if (dto.policeVerificationStatus !== undefined) data.policeVerificationStatus = dto.policeVerificationStatus;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.$transaction(async (tx) => {
      await tx.driver.update({ where: { id }, data });

      // Sync PII changes to Employee backbone
      if (existing.employeeId && (dto.firstName !== undefined || dto.lastName !== undefined || dto.email !== undefined || dto.phone !== undefined || dto.dateOfBirth !== undefined || dto.dateOfJoining !== undefined)) {
        await tx.employee.update({
          where: { id: existing.employeeId },
          data: {
            ...(dto.firstName !== undefined && { firstName: dto.firstName }),
            ...(dto.lastName !== undefined && { lastName: dto.lastName }),
            ...(dto.email !== undefined && { email: dto.email || null }),
            ...(dto.phone !== undefined && { contactPhone: dto.phone }),
            ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
            ...(dto.dateOfJoining !== undefined && { dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null }),
            updatedBy: ctx.userId,
          },
        });
      }
    });

    return { updated: true };
  }

  async deleteDriver(id: string, ctx: RequestContext): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.driver.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Driver not found');
    await this.prisma.driver.update({ where: { id }, data: { softDelete: true, updatedBy: ctx.userId } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  ATTENDANTS  ══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listAttendants(tenantId: string) {
    return this.prisma.attendant.findMany({
      where: { tenantId, softDelete: false },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, contactPhone: true, email: true, dateOfBirth: true, dateOfJoining: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAttendant(dto: CreateAttendantDto, ctx: RequestContext): Promise<{ id: string }> {
    const attendantId = randomUUID();
    const employeeId = randomUUID();

    // Hash DOB as default password (DDMMYYYY format)
    const passwordHash = await this.staffAuth.hashDateOfBirth(
      dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
    );

    // Atomic transaction: Employee backbone + Attendant extension
    await this.prisma.$transaction(async (tx) => {
      // FIRST: Create the unified Employee record
      await tx.employee.create({
        data: {
          id: employeeId,
          tenantId: ctx.tenantId,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          contactPhone: dto.phone,
          email: dto.email ?? null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
          passwordHash,
          requiresPasswordChange: true,
          departmentId: dto.departmentId,
          roleId: dto.roleId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });

      // SECOND: Create the Attendant extension linked to the Employee
      await tx.attendant.create({
        data: {
          id: attendantId,
          tenantId: ctx.tenantId,
          employeeId,
          policeVerificationStatus: dto.policeVerificationStatus ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });
    });

    return { id: attendantId };
  }

  async updateAttendant(id: string, dto: UpdateAttendantDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.attendant.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
      select: { id: true, employeeId: true },
    });
    if (!existing) throw new NotFoundException('Attendant not found');

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.policeVerificationStatus !== undefined) data.policeVerificationStatus = dto.policeVerificationStatus;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.$transaction(async (tx) => {
      await tx.attendant.update({ where: { id }, data });

      // Sync PII changes to Employee backbone
      if (existing.employeeId && (dto.firstName !== undefined || dto.lastName !== undefined || dto.email !== undefined || dto.phone !== undefined || dto.dateOfBirth !== undefined || dto.dateOfJoining !== undefined)) {
        await tx.employee.update({
          where: { id: existing.employeeId },
          data: {
            ...(dto.firstName !== undefined && { firstName: dto.firstName }),
            ...(dto.lastName !== undefined && { lastName: dto.lastName }),
            ...(dto.email !== undefined && { email: dto.email || null }),
            ...(dto.phone !== undefined && { contactPhone: dto.phone }),
            ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
            ...(dto.dateOfJoining !== undefined && { dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null }),
            updatedBy: ctx.userId,
          },
        });
      }
    });

    return { updated: true };
  }

  async deleteAttendant(id: string, ctx: RequestContext): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.attendant.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Attendant not found');
    await this.prisma.attendant.update({ where: { id }, data: { softDelete: true, updatedBy: ctx.userId } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  VEHICLES  ════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listVehicles(tenantId: string) {
    return this.prisma.vehicle.findMany({
      where: { tenantId, softDelete: false },
      orderBy: { registrationNo: 'asc' },
    });
  }

  async createVehicle(dto: CreateVehicleDto, ctx: RequestContext): Promise<{ id: string }> {
    const { id } = await this.prisma.vehicle.create({
      data: {
        tenantId: ctx.tenantId,
        registrationNo: dto.registrationNo,
        vehicleType: dto.vehicleType,
        capacity: dto.capacity,
        fitnessCertificateNo: dto.fitnessCertificateNo ?? null,
        fitnessExpiryDate: dto.fitnessExpiryDate ? new Date(dto.fitnessExpiryDate) : null,
        insurancePolicyNo: dto.insurancePolicyNo ?? null,
        insuranceExpiryDate: dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : null,
        pucCertificateNo: dto.pucCertificateNo ?? null,
        pucExpiryDate: dto.pucExpiryDate ? new Date(dto.pucExpiryDate) : null,
        permitNo: dto.permitNo ?? null,
        permitExpiryDate: dto.permitExpiryDate ? new Date(dto.permitExpiryDate) : null,
        lastServiceDate: dto.lastServiceDate ? new Date(dto.lastServiceDate) : null,
        nextServiceDue: dto.nextServiceDue ? new Date(dto.nextServiceDue) : null,
        odometerReading: dto.odometerReading ?? null,
        gpsDeviceId: dto.gpsDeviceId ?? null,
        cctvInstalled: dto.cctvInstalled ?? false,
        fireExtinguisherAvailable: dto.fireExtinguisherAvailable ?? false,
        firstAidAvailable: dto.firstAidAvailable ?? false,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    return { id };
  }

  async updateVehicle(id: string, dto: UpdateVehicleDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.registrationNo !== undefined) data.registrationNo = dto.registrationNo;
    if (dto.vehicleType !== undefined) data.vehicleType = dto.vehicleType;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.fitnessCertificateNo !== undefined) data.fitnessCertificateNo = dto.fitnessCertificateNo;
    if (dto.fitnessExpiryDate !== undefined) data.fitnessExpiryDate = dto.fitnessExpiryDate ? new Date(dto.fitnessExpiryDate) : null;
    if (dto.insurancePolicyNo !== undefined) data.insurancePolicyNo = dto.insurancePolicyNo;
    if (dto.insuranceExpiryDate !== undefined) data.insuranceExpiryDate = dto.insuranceExpiryDate ? new Date(dto.insuranceExpiryDate) : null;
    if (dto.pucCertificateNo !== undefined) data.pucCertificateNo = dto.pucCertificateNo;
    if (dto.pucExpiryDate !== undefined) data.pucExpiryDate = dto.pucExpiryDate ? new Date(dto.pucExpiryDate) : null;
    if (dto.permitNo !== undefined) data.permitNo = dto.permitNo;
    if (dto.permitExpiryDate !== undefined) data.permitExpiryDate = dto.permitExpiryDate ? new Date(dto.permitExpiryDate) : null;
    if (dto.lastServiceDate !== undefined) data.lastServiceDate = dto.lastServiceDate ? new Date(dto.lastServiceDate) : null;
    if (dto.nextServiceDue !== undefined) data.nextServiceDue = dto.nextServiceDue ? new Date(dto.nextServiceDue) : null;
    if (dto.odometerReading !== undefined) data.odometerReading = dto.odometerReading;
    if (dto.gpsDeviceId !== undefined) data.gpsDeviceId = dto.gpsDeviceId;
    if (dto.cctvInstalled !== undefined) data.cctvInstalled = dto.cctvInstalled;
    if (dto.fireExtinguisherAvailable !== undefined) data.fireExtinguisherAvailable = dto.fireExtinguisherAvailable;
    if (dto.firstAidAvailable !== undefined) data.firstAidAvailable = dto.firstAidAvailable;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.vehicle.update({ where: { id }, data });
    return { updated: true };
  }

  async deleteVehicle(id: string, ctx: RequestContext): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Vehicle not found');
    await this.prisma.vehicle.update({ where: { id }, data: { softDelete: true, updatedBy: ctx.userId } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  STOPS  ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listStops(tenantId: string) {
    return this.prisma.stop.findMany({
      where: { tenantId, softDelete: false },
      orderBy: { name: 'asc' },
      include: {
        routeStops: {
          where: { route: { softDelete: false } },
          select: {
            route: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  async createStop(dto: CreateStopDto, ctx: RequestContext): Promise<{ id: string }> {
    const { id } = await this.prisma.stop.create({
      data: {
        tenantId: ctx.tenantId,
        name: dto.name,
        landmark: dto.landmark ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    return { id };
  }

  async updateStop(id: string, dto: UpdateStopDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.stop.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Stop not found');

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.landmark !== undefined) data.landmark = dto.landmark;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;

    await this.prisma.stop.update({ where: { id }, data });
    return { updated: true };
  }

  async deleteStop(id: string, ctx: RequestContext): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.stop.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Stop not found');
    await this.prisma.stop.update({ where: { id }, data: { softDelete: true, updatedBy: ctx.userId } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  ROUTES (with Trips & Stops)  ═════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listRoutes(tenantId: string) {
    return this.prisma.transportRoute.findMany({
      where: { tenantId, softDelete: false },
      include: {
        trips: {
          where: { softDelete: false },
          include: {
            vehicle: { select: { id: true, registrationNo: true, vehicleType: true } },
            driver: { select: { id: true, employee: { select: { firstName: true } } } },
            attendant: { select: { id: true, employee: { select: { firstName: true } } } },
          },
          orderBy: { tripType: 'asc' },
        },
        stops: {
          where: { softDelete: false },
          include: {
            stop: { select: { id: true, name: true, landmark: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getRoute(id: string, tenantId: string) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id, tenantId, softDelete: false },
      include: {
        trips: {
          where: { softDelete: false },
          include: {
            vehicle: { select: { id: true, registrationNo: true, vehicleType: true } },
            driver: { select: { id: true, employee: { select: { firstName: true } } } },
            attendant: { select: { id: true, employee: { select: { firstName: true } } } },
          },
          orderBy: { tripType: 'asc' },
        },
        stops: {
          where: { softDelete: false },
          include: {
            stop: { select: { id: true, name: true, landmark: true } },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  async createRoute(dto: CreateRouteDto, ctx: RequestContext): Promise<{ id: string }> {
    const { id } = await this.prisma.$transaction(async (tx) => {
      const route = await tx.transportRoute.create({
        data: {
          tenantId: ctx.tenantId,
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });

      if (dto.trips?.length) {
        await tx.routeTrip.createMany({
          data: dto.trips.map((t) => ({
            tenantId: ctx.tenantId,
            routeId: route.id,
            tripType: t.tripType,
            startTime: t.startTime,
            endTime: t.endTime,
            vehicleId: t.vehicleId ?? null,
            driverId: t.driverId ?? null,
            attendantId: t.attendantId ?? null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })),
        });
      }

      if (dto.stops?.length) {
        await tx.routeStop.createMany({
          data: dto.stops.map((s) => ({
            tenantId: ctx.tenantId,
            routeId: route.id,
            stopId: s.stopId,
            sequence: s.sequence,
            distanceKm: s.distanceKm ?? null,
            pickupTime: s.pickupTime ?? null,
            dropTime: s.dropTime ?? null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })),
        });
      }

      return route;
    });
    return { id };
  }

  async saveRouteWithTripsAndStops(
    id: string,
    dto: UpdateRouteDto,
    ctx: RequestContext,
  ): Promise<{ updated: boolean }> {
    const existing = await this.prisma.transportRoute.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Route not found');

    await this.prisma.$transaction(async (tx) => {
      // Update route header
      const routeData: Record<string, unknown> = { updatedBy: ctx.userId };
      if (dto.code !== undefined) routeData.code = dto.code;
      if (dto.name !== undefined) routeData.name = dto.name;
      if (dto.description !== undefined) routeData.description = dto.description;
      if (dto.isActive !== undefined) routeData.isActive = dto.isActive;
      await tx.transportRoute.update({ where: { id }, data: routeData });

      // Differential upsert for Trips: update existing, create new, delete removed
      if (dto.trips !== undefined) {
        const existingTrips = await tx.routeTrip.findMany({ where: { routeId: id, softDelete: false } });
        const existingTripIds = new Set(existingTrips.map((t) => t.id));
        const incomingTripIds = new Set(dto.trips.filter((t) => t.id).map((t) => t.id!));

        // Delete trips removed by user (soft-delete for FK safety)
        const removedTripIds = [...existingTripIds].filter((tid) => !incomingTripIds.has(tid));
        if (removedTripIds.length) {
          await tx.routeTrip.updateMany({ where: { id: { in: removedTripIds } }, data: { softDelete: true, updatedBy: ctx.userId } });
        }

        for (const t of dto.trips) {
          if (t.id && existingTripIds.has(t.id)) {
            // Update existing trip — stable UUID preserved
            await tx.routeTrip.update({
              where: { id: t.id },
              data: {
                tripType: t.tripType,
                startTime: t.startTime,
                endTime: t.endTime,
                vehicleId: t.vehicleId ?? null,
                driverId: t.driverId ?? null,
                attendantId: t.attendantId ?? null,
                updatedBy: ctx.userId,
              },
            });
          } else {
            // Create new trip
            await tx.routeTrip.create({
              data: {
                tenantId: ctx.tenantId,
                routeId: id,
                tripType: t.tripType,
                startTime: t.startTime,
                endTime: t.endTime,
                vehicleId: t.vehicleId ?? null,
                driverId: t.driverId ?? null,
                attendantId: t.attendantId ?? null,
                createdBy: ctx.userId,
                updatedBy: ctx.userId,
              },
            });
          }
        }
      }

      // Differential upsert for Stops: update existing, create new, delete removed
      if (dto.stops !== undefined) {
        const existingStops = await tx.routeStop.findMany({ where: { routeId: id, softDelete: false } });
        const existingStopIds = new Set(existingStops.map((s) => s.id));
        const incomingStopIds = new Set(dto.stops.filter((s) => s.id).map((s) => s.id!));

        // Delete stops removed by user (soft-delete for FK safety)
        const removedStopIds = [...existingStopIds].filter((sid) => !incomingStopIds.has(sid));
        if (removedStopIds.length) {
          await tx.routeStop.updateMany({ where: { id: { in: removedStopIds } }, data: { softDelete: true, updatedBy: ctx.userId } });
        }

        for (const s of dto.stops) {
          if (s.id && existingStopIds.has(s.id)) {
            // Update existing stop — stable UUID preserved
            await tx.routeStop.update({
              where: { id: s.id },
              data: {
                stopId: s.stopId,
                sequence: s.sequence,
                distanceKm: s.distanceKm ?? null,
                pickupTime: s.pickupTime ?? null,
                dropTime: s.dropTime ?? null,
                updatedBy: ctx.userId,
              },
            });
          } else {
            // Create new stop
            await tx.routeStop.create({
              data: {
                tenantId: ctx.tenantId,
                routeId: id,
                stopId: s.stopId,
                sequence: s.sequence,
                distanceKm: s.distanceKm ?? null,
                pickupTime: s.pickupTime ?? null,
                dropTime: s.dropTime ?? null,
                createdBy: ctx.userId,
                updatedBy: ctx.userId,
              },
            });
          }
        }
      }
    });

    return { updated: true };
  }

  async deleteRoute(id: string, ctx: RequestContext): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.transportRoute.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Route not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.routeTrip.updateMany({ where: { routeId: id }, data: { softDelete: true } });
      await tx.routeStop.updateMany({ where: { routeId: id }, data: { softDelete: true } });
      await tx.transportRoute.update({ where: { id }, data: { softDelete: true, updatedBy: ctx.userId } });
    });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  CLONE FROM MASTER  ═══════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clones Vehicles, Stops, Routes, Trips, and RouteStops from MASTER_TEMPLATE
   * into targetTenantId. Does NOT clone Employees/Drivers/Attendants — staff is
   * unique to each school. Cloned trips have driverId/attendantId set to null.
   * Idempotent: skips routes whose code already exists in the target tenant.
   */
  async cloneTransportFromMaster(
    ctx: RequestContext,
  ): Promise<{ vehicles: number; stops: number; routes: number; trips: number; routeStops: number }> {
    const MASTER = 'MASTER_TEMPLATE';
    if (ctx.tenantId === MASTER) {
      throw new BadRequestException('Cannot clone master data into MASTER_TEMPLATE itself');
    }

    // Fetch all master data in parallel
    const [masterVehicles, masterStops, masterRoutes] = await Promise.all([
      this.prisma.vehicle.findMany({ where: { tenantId: MASTER, softDelete: false } }),
      this.prisma.stop.findMany({ where: { tenantId: MASTER, softDelete: false } }),
      this.prisma.transportRoute.findMany({
        where: { tenantId: MASTER, softDelete: false },
        include: {
          trips: { where: { softDelete: false } },
          stops: { where: { softDelete: false }, orderBy: { sequence: 'asc' } },
        },
      }),
    ]);

    if (masterRoutes.length === 0) {
      throw new NotFoundException('No transport master data found in MASTER_TEMPLATE. Run the seeder first.');
    }

    let vehiclesCloned = 0;
    let stopsCloned = 0;
    let routesCloned = 0;
    let tripsCloned = 0;
    let routeStopsCloned = 0;

    await this.prisma.$transaction(async (tx) => {
      // ── Clone Vehicles (skip existing by registrationNo) ────────────────
      const existingVehicleRegs = new Set(
        (await tx.vehicle.findMany({ where: { tenantId: ctx.tenantId, softDelete: false }, select: { registrationNo: true } }))
          .map((v) => v.registrationNo),
      );
      const vehicleIdMap = new Map<string, string>(); // masterVehicleId → newVehicleId

      for (const mv of masterVehicles) {
        if (existingVehicleRegs.has(mv.registrationNo)) {
          // Map to existing local vehicle
          const local = await tx.vehicle.findFirst({ where: { tenantId: ctx.tenantId, registrationNo: mv.registrationNo, softDelete: false } });
          if (local) vehicleIdMap.set(mv.id, local.id);
          continue;
        }

        const newId = randomUUID();
        await tx.vehicle.create({
          data: {
            id: newId,
            tenantId: ctx.tenantId,
            registrationNo: mv.registrationNo,
            vehicleType: mv.vehicleType,
            capacity: mv.capacity,
            fitnessCertificateNo: mv.fitnessCertificateNo,
            fitnessExpiryDate: mv.fitnessExpiryDate,
            insurancePolicyNo: mv.insurancePolicyNo,
            insuranceExpiryDate: mv.insuranceExpiryDate,
            pucCertificateNo: mv.pucCertificateNo,
            pucExpiryDate: mv.pucExpiryDate,
            permitNo: mv.permitNo,
            permitExpiryDate: mv.permitExpiryDate,
            gpsDeviceId: mv.gpsDeviceId,
            cctvInstalled: mv.cctvInstalled,
            fireExtinguisherAvailable: mv.fireExtinguisherAvailable,
            firstAidAvailable: mv.firstAidAvailable,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        });
        vehicleIdMap.set(mv.id, newId);
        vehiclesCloned++;
      }

      // ── Clone Stops (skip existing by name) ────────────────────────────
      const existingStopNames = new Set(
        (await tx.stop.findMany({ where: { tenantId: ctx.tenantId, softDelete: false }, select: { name: true } }))
          .map((s) => s.name),
      );
      const stopIdMap = new Map<string, string>(); // masterStopId → newStopId

      for (const ms of masterStops) {
        if (existingStopNames.has(ms.name)) {
          const local = await tx.stop.findFirst({ where: { tenantId: ctx.tenantId, name: ms.name, softDelete: false } });
          if (local) stopIdMap.set(ms.id, local.id);
          continue;
        }

        const newId = randomUUID();
        await tx.stop.create({
          data: {
            id: newId,
            tenantId: ctx.tenantId,
            name: ms.name,
            landmark: ms.landmark,
            latitude: ms.latitude,
            longitude: ms.longitude,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        });
        stopIdMap.set(ms.id, newId);
        stopsCloned++;
      }

      // ── Clone Routes, Trips, RouteStops (skip existing by code) ────────
      const existingRouteCodes = new Set(
        (await tx.transportRoute.findMany({ where: { tenantId: ctx.tenantId, softDelete: false }, select: { code: true } }))
          .map((r) => r.code),
      );

      for (const mr of masterRoutes) {
        if (existingRouteCodes.has(mr.code)) continue;

        const newRouteId = randomUUID();
        await tx.transportRoute.create({
          data: {
            id: newRouteId,
            tenantId: ctx.tenantId,
            code: mr.code,
            name: mr.name,
            description: mr.description,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        });
        routesCloned++;

        // Clone trips — vehicle mapped, driver/attendant set to null
        for (const mt of mr.trips) {
          await tx.routeTrip.create({
            data: {
              tenantId: ctx.tenantId,
              routeId: newRouteId,
              tripType: mt.tripType,
              startTime: mt.startTime,
              endTime: mt.endTime,
              vehicleId: mt.vehicleId ? (vehicleIdMap.get(mt.vehicleId) ?? null) : null,
              driverId: null,    // Staff is school-specific — admin assigns locally
              attendantId: null, // Staff is school-specific — admin assigns locally
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
          });
          tripsCloned++;
        }

        // Clone route-stops — stop IDs mapped to local
        for (const ms of mr.stops) {
          const localStopId = stopIdMap.get(ms.stopId);
          if (!localStopId) continue; // stop not mapped — skip

          await tx.routeStop.create({
            data: {
              tenantId: ctx.tenantId,
              routeId: newRouteId,
              stopId: localStopId,
              sequence: ms.sequence,
              distanceKm: ms.distanceKm,
              pickupTime: ms.pickupTime,
              dropTime: ms.dropTime,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
          });
          routeStopsCloned++;
        }
      }
    });

    return {
      vehicles: vehiclesCloned,
      stops: stopsCloned,
      routes: routesCloned,
      trips: tripsCloned,
      routeStops: routeStopsCloned,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  MASTER SEEDER  ══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Seeds MASTER_TEMPLATE with enterprise-scale transport data.
   * Fully self-contained — creates tenant, HR, staff, fleet, stops, routes, trips, schedules.
   * Fully idempotent — safe to run multiple times.
   * Surfaces exact Prisma error messages on failure.
   */
  async seedMasterData(userId: string): Promise<{
    drivers: number; attendants: number; vehicles: number;
    stops: number; routes: number; trips: number; routeStops: number;
  }> {
    const TENANT = 'MASTER_TEMPLATE';
    const SYSTEM = userId || 'SYSTEM_SEEDER';

    // ── Early idempotency check: if routes already exist, short-circuit ─────
    const existingRouteCount = await this.prisma.transportRoute.count({
      where: { tenantId: TENANT, softDelete: false },
    });
    if (existingRouteCount >= 5) {
      return { drivers: 0, attendants: 0, vehicles: 0, stops: 0, routes: 0, trips: 0, routeStops: 0 };
    }

    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    const sixMonthsOut = new Date();
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

    const DRIVER_PROFILES = [
      { firstName: 'Rajesh',  lastName: 'Kumar',  phone: '+91-9876543201', email: 'rajesh.kumar@school.edu',  license: 'DL-0420110012345', badge: 'BD-001' },
      { firstName: 'Sunil',   lastName: 'Sharma', phone: '+91-9876543202', email: 'sunil.sharma@school.edu',  license: 'DL-0420110012346', badge: 'BD-002' },
      { firstName: 'Vikram',  lastName: 'Singh',  phone: '+91-9876543203', email: 'vikram.singh@school.edu',  license: 'DL-0420110012347', badge: 'BD-003' },
      { firstName: 'Manoj',   lastName: 'Yadav',  phone: '+91-9876543204', email: 'manoj.yadav@school.edu',   license: 'DL-0420110012348', badge: 'BD-004' },
      { firstName: 'Deepak',  lastName: 'Verma',  phone: '+91-9876543205', email: 'deepak.verma@school.edu',  license: 'DL-0420110012349', badge: 'BD-005' },
      { firstName: 'Arun',    lastName: 'Patel',  phone: '+91-9876543206', email: 'arun.patel@school.edu',    license: 'DL-0420110012350', badge: 'BD-006' },
    ];

    const ATTENDANT_PROFILES = [
      { firstName: 'Suresh', lastName: 'Nair',   phone: '+91-9876543301', email: 'suresh.nair@school.edu'  },
      { firstName: 'Ramesh', lastName: 'Gupta',  phone: '+91-9876543302', email: 'ramesh.gupta@school.edu' },
      { firstName: 'Kiran',  lastName: 'Devi',   phone: '+91-9876543303', email: 'kiran.devi@school.edu'   },
      { firstName: 'Meena',  lastName: 'Kumari', phone: '+91-9876543304', email: 'meena.kumari@school.edu' },
      { firstName: 'Laxmi',  lastName: 'Prasad', phone: '+91-9876543305', email: 'laxmi.prasad@school.edu' },
      { firstName: 'Priya',  lastName: 'Reddy',  phone: '+91-9876543306', email: 'priya.reddy@school.edu'  },
    ];

    const VEHICLES = [
      { reg: 'DL-01-AB-1001', type: '40-Seater Bus',     cap: 40, insurance: 'INS-BUS-001', fitness: 'FIT-BUS-001', puc: 'PUC-BUS-001' },
      { reg: 'DL-01-AB-1002', type: '40-Seater Bus',     cap: 40, insurance: 'INS-BUS-002', fitness: 'FIT-BUS-002', puc: 'PUC-BUS-002' },
      { reg: 'DL-01-AB-1003', type: '40-Seater Bus',     cap: 40, insurance: 'INS-BUS-003', fitness: 'FIT-BUS-003', puc: 'PUC-BUS-003' },
      { reg: 'DL-01-CD-2001', type: '20-Seater Minivan', cap: 20, insurance: 'INS-VAN-001', fitness: 'FIT-VAN-001', puc: 'PUC-VAN-001' },
      { reg: 'DL-01-CD-2002', type: '20-Seater Minivan', cap: 20, insurance: 'INS-VAN-002', fitness: 'FIT-VAN-002', puc: 'PUC-VAN-002' },
      { reg: 'DL-01-CD-2003', type: '20-Seater Minivan', cap: 20, insurance: 'INS-VAN-003', fitness: 'FIT-VAN-003', puc: 'PUC-VAN-003' },
    ];

    const STOPS = [
      { name: 'City Center Metro',       landmark: 'Near Metro Station Gate 3' },
      { name: 'Oakwood Estate',           landmark: 'Main entrance, Block A' },
      { name: 'Tech Park Gate',           landmark: 'IT Park Main Gate' },
      { name: 'Sunrise Apartments',       landmark: 'Society clubhouse' },
      { name: 'Green Valley Colony',      landmark: 'Community hall junction' },
      { name: 'Lakeview Heights',         landmark: 'Near water tank' },
      { name: 'Market Square',            landmark: 'Opposite municipal market' },
      { name: 'Railway Station Road',     landmark: 'Platform 1 overbridge' },
      { name: 'University Circle',        landmark: 'Main university gate' },
      { name: 'Hospital Junction',        landmark: 'Opposite district hospital' },
      { name: 'Airport Highway',          landmark: 'Service road T-junction' },
      { name: 'Industrial Area Phase 1',  landmark: 'Factory gate cluster' },
      { name: 'Riverside Garden',         landmark: 'Park entrance' },
      { name: 'MG Road Crossing',         landmark: 'Traffic signal junction' },
      { name: 'Nehru Nagar',              landmark: 'Community center' },
      { name: 'Shanti Niketan',           landmark: 'Temple road corner' },
      { name: 'Vidya Vihar',              landmark: 'School complex gate' },
      { name: 'Rajendra Chowk',           landmark: 'Clock tower roundabout' },
      { name: 'Defence Colony',            landmark: 'Sector-4 main gate' },
      { name: 'Satellite Town Hub',        landmark: 'Bus depot adjacent' },
    ];

    const ROUTES = [
      { code: 'R-01', name: 'North Loop',       desc: 'Northern suburban circuit via Oakwood and Green Valley',  stops: [0, 1, 4, 5] },
      { code: 'R-02', name: 'South Express',    desc: 'Southern express via Railway Station and Market Square',   stops: [7, 6, 9, 14] },
      { code: 'R-03', name: 'East West Link',   desc: 'Cross-city link from Tech Park to University Circle',     stops: [2, 3, 8, 12] },
      { code: 'R-04', name: 'Central Direct',   desc: 'City center direct service via MG Road and Hospital',     stops: [0, 13, 9, 17] },
      { code: 'R-05', name: 'Suburb Connector', desc: 'Outer ring connecting Defence Colony to Satellite Town',  stops: [10, 11, 18, 19] },
    ];

    const MORNING_TIMES = ['07:00', '07:15', '07:30', '07:45'];
    const EVENING_TIMES = ['15:30', '15:45', '16:00', '16:15'];

    let driversSeeded = 0;
    let attendantsSeeded = 0;
    let vehiclesSeeded = 0;
    let stopsSeeded = 0;
    let routesSeeded = 0;
    let tripsSeeded = 0;
    let routeStopsSeeded = 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        // 0. Guarantee MASTER_TEMPLATE tenant partition exists
        await tx.tenant.upsert({
          where:  { id: TENANT },
          update: {},
          create: {
            id:     TENANT,
            code:   'MASTER-TPL',
            name:   'System Master Template',
            status: TenantStatus.ACTIVE,
            domain: 'master.internal',
          },
        });

        // 1. HR Foundation
        const dept = await tx.department.upsert({
          where: { tenantId_code: { tenantId: TENANT, code: 'TRANSPORT' } },
          update: {},
          create: { id: randomUUID(), tenantId: TENANT, name: 'Transport', code: 'TRANSPORT', createdBy: SYSTEM, updatedBy: SYSTEM },
        });

        const driverRole = await tx.employeeRole.upsert({
          where: { tenantId_code: { tenantId: TENANT, code: 'BUS_DRIVER' } },
          update: { systemCategory: 'DRIVER' },
          create: { id: randomUUID(), tenantId: TENANT, name: 'Bus Driver', code: 'BUS_DRIVER', departmentId: dept.id, systemCategory: 'DRIVER', createdBy: SYSTEM, updatedBy: SYSTEM },
        });

        const attendantRole = await tx.employeeRole.upsert({
          where: { tenantId_code: { tenantId: TENANT, code: 'BUS_ATTENDANT' } },
          update: { systemCategory: 'ATTENDANT' },
          create: { id: randomUUID(), tenantId: TENANT, name: 'Bus Attendant', code: 'BUS_ATTENDANT', departmentId: dept.id, systemCategory: 'ATTENDANT', createdBy: SYSTEM, updatedBy: SYSTEM },
        });

        // 2. Drivers (Employee + Driver atomically)
        const driverIds: string[] = [];
        for (const p of DRIVER_PROFILES) {
          const existing = await tx.driver.findFirst({ where: { tenantId: TENANT, licenseNumber: p.license, softDelete: false } });
          if (existing) { driverIds.push(existing.id); continue; }

          const empId = randomUUID();
          const drvId = randomUUID();
          await tx.employee.create({
            data: { id: empId, tenantId: TENANT, firstName: p.firstName, lastName: p.lastName, contactPhone: p.phone, email: p.email, departmentId: dept.id, roleId: driverRole.id, createdBy: SYSTEM, updatedBy: SYSTEM },
          });
          await tx.driver.create({
            data: { id: drvId, tenantId: TENANT, employeeId: empId, licenseNumber: p.license, licenseExpiry: oneYearOut, badgeNumber: p.badge, badgeExpiry: oneYearOut, policeVerificationStatus: 'VERIFIED', createdBy: SYSTEM, updatedBy: SYSTEM },
          });
          driverIds.push(drvId);
          driversSeeded++;
        }

        // 3. Attendants (Employee + Attendant atomically)
        const attendantIds: string[] = [];
        for (const p of ATTENDANT_PROFILES) {
          const existing = await tx.attendant.findFirst({ where: { tenantId: TENANT, employee: { contactPhone: p.phone }, softDelete: false } });
          if (existing) { attendantIds.push(existing.id); continue; }

          const empId = randomUUID();
          const attId = randomUUID();
          await tx.employee.create({
            data: { id: empId, tenantId: TENANT, firstName: p.firstName, lastName: p.lastName, contactPhone: p.phone, email: p.email, departmentId: dept.id, roleId: attendantRole.id, createdBy: SYSTEM, updatedBy: SYSTEM },
          });
          await tx.attendant.create({
            data: { id: attId, tenantId: TENANT, employeeId: empId, policeVerificationStatus: 'VERIFIED', createdBy: SYSTEM, updatedBy: SYSTEM },
          });
          attendantIds.push(attId);
          attendantsSeeded++;
        }

        // 4. Vehicles
        const vehicleIds: string[] = [];
        for (const v of VEHICLES) {
          const existing = await tx.vehicle.findFirst({ where: { tenantId: TENANT, registrationNo: v.reg, softDelete: false } });
          if (existing) { vehicleIds.push(existing.id); continue; }

          const vId = randomUUID();
          await tx.vehicle.create({
            data: {
              id: vId, tenantId: TENANT, registrationNo: v.reg, vehicleType: v.type, capacity: v.cap,
              insurancePolicyNo: v.insurance, insuranceExpiryDate: oneYearOut,
              fitnessCertificateNo: v.fitness, fitnessExpiryDate: oneYearOut,
              pucCertificateNo: v.puc, pucExpiryDate: sixMonthsOut,
              fireExtinguisherAvailable: true, firstAidAvailable: true,
              createdBy: SYSTEM, updatedBy: SYSTEM,
            },
          });
          vehicleIds.push(vId);
          vehiclesSeeded++;
        }

        // 5. Stops
        const stopIds: string[] = [];
        for (const s of STOPS) {
          const existing = await tx.stop.findFirst({ where: { tenantId: TENANT, name: s.name, softDelete: false } });
          if (existing) { stopIds.push(existing.id); continue; }

          const sId = randomUUID();
          await tx.stop.create({
            data: { id: sId, tenantId: TENANT, name: s.name, landmark: s.landmark, createdBy: SYSTEM, updatedBy: SYSTEM },
          });
          stopIds.push(sId);
          stopsSeeded++;
        }

        // 6. Routes + Trips
        const routeRecords: { routeId: string; stops: number[] }[] = [];
        for (let ri = 0; ri < ROUTES.length; ri++) {
          const r = ROUTES[ri];
          const existing = await tx.transportRoute.findFirst({ where: { tenantId: TENANT, code: r.code, softDelete: false } });
          if (existing) { routeRecords.push({ routeId: existing.id, stops: r.stops }); continue; }

          const routeId = randomUUID();
          await tx.transportRoute.create({
            data: { id: routeId, tenantId: TENANT, code: r.code, name: r.name, description: r.desc, createdBy: SYSTEM, updatedBy: SYSTEM },
          });

          const mVeh = vehicleIds[ri % vehicleIds.length];
          const mDrv = driverIds[ri % driverIds.length];
          const mAtt = attendantIds[ri % attendantIds.length];
          const eDrv = driverIds[(ri + 1) % driverIds.length];
          const eAtt = attendantIds[(ri + 1) % attendantIds.length];

          await tx.routeTrip.create({
            data: { tenantId: TENANT, routeId, tripType: 'MORNING', startTime: '07:00', endTime: '08:00', vehicleId: mVeh, driverId: mDrv, attendantId: mAtt, createdBy: SYSTEM, updatedBy: SYSTEM },
          });
          await tx.routeTrip.create({
            data: { tenantId: TENANT, routeId, tripType: 'EVENING', startTime: '15:30', endTime: '16:30', vehicleId: mVeh, driverId: eDrv, attendantId: eAtt, createdBy: SYSTEM, updatedBy: SYSTEM },
          });
          routeRecords.push({ routeId, stops: r.stops });
          routesSeeded++;
          tripsSeeded += 2;
        }

        // 7. RouteStops
        for (const rec of routeRecords) {
          for (let seq = 0; seq < rec.stops.length; seq++) {
            const sId = stopIds[rec.stops[seq]];
            const existing = await tx.routeStop.findFirst({ where: { routeId: rec.routeId, stopId: sId, softDelete: false } });
            if (existing) continue;

            await tx.routeStop.create({
              data: {
                tenantId: TENANT, routeId: rec.routeId, stopId: sId, sequence: seq + 1,
                distanceKm: (seq + 1) * 3.5, pickupTime: MORNING_TIMES[seq], dropTime: EVENING_TIMES[seq],
                createdBy: SYSTEM, updatedBy: SYSTEM,
              },
            });
            routeStopsSeeded++;
          }
        }
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[seedMasterData] FAILED:', msg);
      throw new InternalServerErrorException(`Transport master seeder failed: ${msg}`);
    }

    return {
      drivers: driversSeeded,
      attendants: attendantsSeeded,
      vehicles: vehiclesSeeded,
      stops: stopsSeeded,
      routes: routesSeeded,
      trips: tripsSeeded,
      routeStops: routeStopsSeeded,
    };
  }
}
