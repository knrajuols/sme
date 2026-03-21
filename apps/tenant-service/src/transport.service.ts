import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  DRIVERS  ═════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listDrivers(tenantId: string) {
    return this.prisma.driver.findMany({
      where: { tenantId, softDelete: false },
      orderBy: { name: 'asc' },
    });
  }

  async createDriver(dto: CreateDriverDto, ctx: RequestContext): Promise<{ id: string }> {
    const { id } = await this.prisma.driver.create({
      data: {
        tenantId: ctx.tenantId,
        name: dto.name,
        mobile: dto.mobile,
        licenseNumber: dto.licenseNumber,
        licenseExpiry: new Date(dto.licenseExpiry),
        badgeNumber: dto.badgeNumber ?? null,
        badgeExpiry: dto.badgeExpiry ? new Date(dto.badgeExpiry) : null,
        policeVerificationStatus: dto.policeVerificationStatus ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    return { id };
  }

  async updateDriver(id: string, dto: UpdateDriverDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.driver.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Driver not found');

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.mobile !== undefined) data.mobile = dto.mobile;
    if (dto.licenseNumber !== undefined) data.licenseNumber = dto.licenseNumber;
    if (dto.licenseExpiry !== undefined) data.licenseExpiry = new Date(dto.licenseExpiry);
    if (dto.badgeNumber !== undefined) data.badgeNumber = dto.badgeNumber;
    if (dto.badgeExpiry !== undefined) data.badgeExpiry = dto.badgeExpiry ? new Date(dto.badgeExpiry) : null;
    if (dto.policeVerificationStatus !== undefined) data.policeVerificationStatus = dto.policeVerificationStatus;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.driver.update({ where: { id }, data });
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
      orderBy: { name: 'asc' },
    });
  }

  async createAttendant(dto: CreateAttendantDto, ctx: RequestContext): Promise<{ id: string }> {
    const { id } = await this.prisma.attendant.create({
      data: {
        tenantId: ctx.tenantId,
        name: dto.name,
        mobile: dto.mobile,
        policeVerificationStatus: dto.policeVerificationStatus ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    return { id };
  }

  async updateAttendant(id: string, dto: UpdateAttendantDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.attendant.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('Attendant not found');

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.mobile !== undefined) data.mobile = dto.mobile;
    if (dto.policeVerificationStatus !== undefined) data.policeVerificationStatus = dto.policeVerificationStatus;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.attendant.update({ where: { id }, data });
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
            driver: { select: { id: true, name: true } },
            attendant: { select: { id: true, name: true } },
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
            driver: { select: { id: true, name: true } },
            attendant: { select: { id: true, name: true } },
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
}
