/**
 * transport-analytics.service.ts — Transport Fleet Analytics Aggregation
 * ──────────────────────────────────────────────────────────────────────────────
 * Prompt #288 — Highly optimized dashboard aggregation for fleet utilization
 * at Overall, Vehicle, Route, and Stop levels.
 * All queries strictly scoped by tenantId. ZERO cross-tenant data bleed.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

// ── Response Interfaces ──────────────────────────────────────────────────────

interface VehicleUtilization {
  vehicleId: string;
  registrationNo: string;
  vehicleType: string;
  capacity: number;
  allocatedSeats: number;
  utilizationPercent: number;
}

interface RouteUtilization {
  routeId: string;
  routeCode: string;
  routeName: string;
  vehicleCount: number;
  totalCapacity: number;
  allocatedStudents: number;
  utilizationPercent: number;
}

interface StopUtilization {
  stopId: string;
  stopName: string;
  pickupCount: number;
  dropCount: number;
}

interface OverallFleet {
  totalVehicles: number;
  totalCapacity: number;
  totalAllocated: number;
  utilizationPercent: number;
}

export interface TransportDashboardPayload {
  overall: OverallFleet;
  vehicles: VehicleUtilization[];
  routes: RouteUtilization[];
  stops: StopUtilization[];
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TransportAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates transport fleet utilization at four levels:
   * Overall, Vehicle-wise, Route-wise, Stop-wise.
   *
   * Uses Promise.all() for parallel execution of independent queries.
   */
  async getDashboard(tenantId: string): Promise<TransportDashboardPayload> {
    const [vehicles, routes, stops] = await Promise.all([
      this.getVehicleUtilization(tenantId),
      this.getRouteUtilization(tenantId),
      this.getStopUtilization(tenantId),
    ]);

    // Overall aggregation derived from vehicle-level data
    const totalVehicles = vehicles.length;
    const totalCapacity = vehicles.reduce((sum, v) => sum + v.capacity, 0);
    const totalAllocated = vehicles.reduce((sum, v) => sum + v.allocatedSeats, 0);

    const overall: OverallFleet = {
      totalVehicles,
      totalCapacity,
      totalAllocated,
      utilizationPercent: totalCapacity > 0
        ? Math.round((totalAllocated / totalCapacity) * 100)
        : 0,
    };

    return { overall, vehicles, routes, stops };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  VEHICLE UTILIZATION  ═════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  private async getVehicleUtilization(tenantId: string): Promise<VehicleUtilization[]> {
    // 1. Get all active vehicles with their trip assignments
    const vehiclesWithTrips = await this.prisma.vehicle.findMany({
      where: { tenantId, softDelete: false, isActive: true },
      select: {
        id: true,
        registrationNo: true,
        vehicleType: true,
        capacity: true,
        trips: {
          where: { softDelete: false },
          select: { id: true },
        },
      },
      orderBy: { registrationNo: 'asc' },
    });

    // 2. Get allocation counts grouped by trip for this tenant
    const allTripIds = vehiclesWithTrips.flatMap((v) => v.trips.map((t) => t.id));
    if (allTripIds.length === 0) {
      return vehiclesWithTrips.map((v) => ({
        vehicleId: v.id,
        registrationNo: v.registrationNo,
        vehicleType: v.vehicleType,
        capacity: v.capacity,
        allocatedSeats: 0,
        utilizationPercent: 0,
      }));
    }

    // Count distinct students allocated via pickup OR drop trips per vehicle
    // A student linked to a vehicle's trip (either pickup or drop) = 1 seat used
    const allocations = await this.prisma.transportAllocation.findMany({
      where: {
        tenantId,
        softDelete: false,
        isActive: true,
        OR: [
          { pickupTripId: { in: allTripIds } },
          { dropTripId: { in: allTripIds } },
        ],
      },
      select: {
        studentId: true,
        pickupTripId: true,
        dropTripId: true,
      },
    });

    // Build trip → unique student count map
    const tripStudentMap = new Map<string, Set<string>>();
    for (const a of allocations) {
      if (!tripStudentMap.has(a.pickupTripId)) tripStudentMap.set(a.pickupTripId, new Set());
      tripStudentMap.get(a.pickupTripId)!.add(a.studentId);
      if (!tripStudentMap.has(a.dropTripId)) tripStudentMap.set(a.dropTripId, new Set());
      tripStudentMap.get(a.dropTripId)!.add(a.studentId);
    }

    return vehiclesWithTrips.map((v) => {
      // Unique students across all trips for this vehicle
      const studentSet = new Set<string>();
      for (const trip of v.trips) {
        const students = tripStudentMap.get(trip.id);
        if (students) students.forEach((s) => studentSet.add(s));
      }
      const allocatedSeats = studentSet.size;
      return {
        vehicleId: v.id,
        registrationNo: v.registrationNo,
        vehicleType: v.vehicleType,
        capacity: v.capacity,
        allocatedSeats,
        utilizationPercent: v.capacity > 0
          ? Math.round((allocatedSeats / v.capacity) * 100)
          : 0,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  ROUTE UTILIZATION  ═══════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  private async getRouteUtilization(tenantId: string): Promise<RouteUtilization[]> {
    const routesData = await this.prisma.transportRoute.findMany({
      where: { tenantId, softDelete: false, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        trips: {
          where: { softDelete: false },
          select: {
            id: true,
            vehicleId: true,
            vehicle: { select: { capacity: true } },
          },
        },
        transportAllocations: {
          where: { softDelete: false, isActive: true },
          select: { studentId: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return routesData.map((r) => {
      // Count distinct vehicles used on trips
      const vehicleIds = new Set(
        r.trips.filter((t) => t.vehicleId).map((t) => t.vehicleId!),
      );
      const vehicleCount = vehicleIds.size;

      // Sum capacity of distinct vehicles on this route's trips
      const vehicleCapMap = new Map<string, number>();
      for (const t of r.trips) {
        if (t.vehicleId && t.vehicle) {
          vehicleCapMap.set(t.vehicleId, t.vehicle.capacity);
        }
      }
      const totalCapacity = Array.from(vehicleCapMap.values()).reduce((s, c) => s + c, 0);

      // Count distinct allocated students on this route
      const uniqueStudents = new Set(r.transportAllocations.map((a) => a.studentId));
      const allocatedStudents = uniqueStudents.size;

      return {
        routeId: r.id,
        routeCode: r.code,
        routeName: r.name,
        vehicleCount,
        totalCapacity,
        allocatedStudents,
        utilizationPercent: totalCapacity > 0
          ? Math.round((allocatedStudents / totalCapacity) * 100)
          : 0,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  STOP UTILIZATION  ════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  private async getStopUtilization(tenantId: string): Promise<StopUtilization[]> {
    // Get all active allocations with their pickup/drop stop → stop name
    const allocations = await this.prisma.transportAllocation.findMany({
      where: { tenantId, softDelete: false, isActive: true },
      select: {
        pickupStop: { select: { stop: { select: { id: true, name: true } } } },
        dropStop: { select: { stop: { select: { id: true, name: true } } } },
      },
    });

    // Aggregate pickup / drop counts per stop
    const stopMap = new Map<string, { name: string; pickupCount: number; dropCount: number }>();

    for (const a of allocations) {
      const pId = a.pickupStop.stop.id;
      if (!stopMap.has(pId)) stopMap.set(pId, { name: a.pickupStop.stop.name, pickupCount: 0, dropCount: 0 });
      stopMap.get(pId)!.pickupCount++;

      const dId = a.dropStop.stop.id;
      if (!stopMap.has(dId)) stopMap.set(dId, { name: a.dropStop.stop.name, pickupCount: 0, dropCount: 0 });
      stopMap.get(dId)!.dropCount++;
    }

    return Array.from(stopMap, ([stopId, data]) => ({
      stopId,
      stopName: data.name,
      pickupCount: data.pickupCount,
      dropCount: data.dropCount,
    })).sort((a, b) => (b.pickupCount + b.dropCount) - (a.pickupCount + a.dropCount));
  }
}
