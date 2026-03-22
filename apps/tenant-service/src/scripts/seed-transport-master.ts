/**
 * seed-transport-master.ts — Enterprise Master Seeder for Transport Module
 * ──────────────────────────────────────────────────────────────────────────────
 * Populates MASTER_TEMPLATE with realistic transport data:
 *   1. HR Foundation: Transport Department + Driver/Attendant Roles
 *   2. Staff: 6 Drivers (Employee + Driver) + 6 Attendants (Employee + Attendant)
 *   3. Fleet: 6 Vehicles (3 × 40-Seat Bus, 3 × 20-Seat Minivan)
 *   4. Geography: 20 Stops
 *   5. Routes: 5 Transport Routes
 *   6. Trips: 2 RouteTrips per route (Morning + Evening)
 *   7. Schedules: RouteStops mapping stops across routes
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/seed-transport-master.ts
 */
import { PrismaClient } from '../generated/prisma-client';
import { randomUUID } from 'crypto';

// ── Prisma client with direct DATABASE_URL ──────────────────────────────────
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:Olsbook55@localhost:5432/sme_tenant?schema=public';

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});
const TENANT = 'MASTER_TEMPLATE';
const SYSTEM = 'SYSTEM_SEEDER';

// ── Future compliance dates (1 year out) ─────────────────────────────────────
const oneYearOut = new Date();
oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
const sixMonthsOut = new Date();
sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

// ── Realistic Indian names for staff ─────────────────────────────────────────
const DRIVER_PROFILES = [
  { firstName: 'Rajesh',  lastName: 'Kumar',   phone: '+91-9876543201', email: 'rajesh.kumar@school.edu',   license: 'DL-0420110012345', badge: 'BD-001' },
  { firstName: 'Sunil',   lastName: 'Sharma',  phone: '+91-9876543202', email: 'sunil.sharma@school.edu',   license: 'DL-0420110012346', badge: 'BD-002' },
  { firstName: 'Vikram',  lastName: 'Singh',   phone: '+91-9876543203', email: 'vikram.singh@school.edu',   license: 'DL-0420110012347', badge: 'BD-003' },
  { firstName: 'Manoj',   lastName: 'Yadav',   phone: '+91-9876543204', email: 'manoj.yadav@school.edu',    license: 'DL-0420110012348', badge: 'BD-004' },
  { firstName: 'Deepak',  lastName: 'Verma',   phone: '+91-9876543205', email: 'deepak.verma@school.edu',   license: 'DL-0420110012349', badge: 'BD-005' },
  { firstName: 'Arun',    lastName: 'Patel',   phone: '+91-9876543206', email: 'arun.patel@school.edu',     license: 'DL-0420110012350', badge: 'BD-006' },
];

const ATTENDANT_PROFILES = [
  { firstName: 'Suresh',   lastName: 'Nair',     phone: '+91-9876543301', email: 'suresh.nair@school.edu'   },
  { firstName: 'Ramesh',   lastName: 'Gupta',    phone: '+91-9876543302', email: 'ramesh.gupta@school.edu'  },
  { firstName: 'Kiran',    lastName: 'Devi',     phone: '+91-9876543303', email: 'kiran.devi@school.edu'    },
  { firstName: 'Meena',    lastName: 'Kumari',   phone: '+91-9876543304', email: 'meena.kumari@school.edu'  },
  { firstName: 'Laxmi',    lastName: 'Prasad',   phone: '+91-9876543305', email: 'laxmi.prasad@school.edu'  },
  { firstName: 'Priya',    lastName: 'Reddy',    phone: '+91-9876543306', email: 'priya.reddy@school.edu'   },
];

// ── Fleet ────────────────────────────────────────────────────────────────────
const VEHICLES = [
  { reg: 'DL-01-AB-1001', type: '40-Seater Bus',    cap: 40, insurance: 'INS-BUS-001',  fitness: 'FIT-BUS-001',  puc: 'PUC-BUS-001'  },
  { reg: 'DL-01-AB-1002', type: '40-Seater Bus',    cap: 40, insurance: 'INS-BUS-002',  fitness: 'FIT-BUS-002',  puc: 'PUC-BUS-002'  },
  { reg: 'DL-01-AB-1003', type: '40-Seater Bus',    cap: 40, insurance: 'INS-BUS-003',  fitness: 'FIT-BUS-003',  puc: 'PUC-BUS-003'  },
  { reg: 'DL-01-CD-2001', type: '20-Seater Minivan', cap: 20, insurance: 'INS-VAN-001', fitness: 'FIT-VAN-001', puc: 'PUC-VAN-001' },
  { reg: 'DL-01-CD-2002', type: '20-Seater Minivan', cap: 20, insurance: 'INS-VAN-002', fitness: 'FIT-VAN-002', puc: 'PUC-VAN-002' },
  { reg: 'DL-01-CD-2003', type: '20-Seater Minivan', cap: 20, insurance: 'INS-VAN-003', fitness: 'FIT-VAN-003', puc: 'PUC-VAN-003' },
];

// ── Geography (20 realistic stops) ──────────────────────────────────────────
const STOPS = [
  { name: 'City Center Metro',     landmark: 'Near Metro Station Gate 3' },
  { name: 'Oakwood Estate',        landmark: 'Main entrance, Block A' },
  { name: 'Tech Park Gate',        landmark: 'IT Park Main Gate' },
  { name: 'Sunrise Apartments',    landmark: 'Society clubhouse' },
  { name: 'Green Valley Colony',   landmark: 'Community hall junction' },
  { name: 'Lakeview Heights',      landmark: 'Near water tank' },
  { name: 'Market Square',         landmark: 'Opposite municipal market' },
  { name: 'Railway Station Road',  landmark: 'Platform 1 overbridge' },
  { name: 'University Circle',     landmark: 'Main university gate' },
  { name: 'Hospital Junction',     landmark: 'Opposite district hospital' },
  { name: 'Airport Highway',       landmark: 'Service road T-junction' },
  { name: 'Industrial Area Phase 1', landmark: 'Factory gate cluster' },
  { name: 'Riverside Garden',      landmark: 'Park entrance' },
  { name: 'MG Road Crossing',      landmark: 'Traffic signal junction' },
  { name: 'Nehru Nagar',           landmark: 'Community center' },
  { name: 'Shanti Niketan',        landmark: 'Temple road corner' },
  { name: 'Vidya Vihar',           landmark: 'School complex gate' },
  { name: 'Rajendra Chowk',       landmark: 'Clock tower roundabout' },
  { name: 'Defence Colony',        landmark: 'Sector-4 main gate' },
  { name: 'Satellite Town Hub',    landmark: 'Bus depot adjacent' },
];

// ── Routes with stop assignments ────────────────────────────────────────────
const ROUTES = [
  { code: 'R-01', name: 'North Loop',        desc: 'Northern suburban circuit via Oakwood and Green Valley',   stops: [0, 1, 4, 5] },
  { code: 'R-02', name: 'South Express',     desc: 'Southern express via Railway Station and Market Square',    stops: [7, 6, 9, 14] },
  { code: 'R-03', name: 'East West Link',    desc: 'Cross-city link from Tech Park to University Circle',       stops: [2, 3, 8, 12] },
  { code: 'R-04', name: 'Central Direct',    desc: 'City center direct service via MG Road and Hospital',       stops: [0, 13, 9, 17] },
  { code: 'R-05', name: 'Suburb Connector',  desc: 'Outer ring connecting Defence Colony to Satellite Town',    stops: [10, 11, 18, 19] },
];

// ── Morning/Evening time templates (pickup times per stop sequence) ──────────
const MORNING_TIMES = ['07:00', '07:15', '07:30', '07:45'];
const EVENING_TIMES = ['15:30', '15:45', '16:00', '16:15'];

async function main() {
  console.log('🚌 Transport Master Seeder — Start');
  console.log(`   Tenant: ${TENANT}`);

  await prisma.$transaction(async (tx) => {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. HR FOUNDATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  [1/7] HR Foundation — Department + Roles...');

    const dept = await tx.department.upsert({
      where: { tenantId_code: { tenantId: TENANT, code: 'TRANSPORT' } },
      update: {},
      create: {
        id: randomUUID(),
        tenantId: TENANT,
        name: 'Transport',
        code: 'TRANSPORT',
        createdBy: SYSTEM,
        updatedBy: SYSTEM,
      },
    });

    const driverRole = await tx.employeeRole.upsert({
      where: { tenantId_code: { tenantId: TENANT, code: 'BUS_DRIVER' } },
      update: { systemCategory: 'DRIVER' },
      create: {
        id: randomUUID(),
        tenantId: TENANT,
        name: 'Bus Driver',
        code: 'BUS_DRIVER',
        departmentId: dept.id,
        systemCategory: 'DRIVER',
        createdBy: SYSTEM,
        updatedBy: SYSTEM,
      },
    });

    const attendantRole = await tx.employeeRole.upsert({
      where: { tenantId_code: { tenantId: TENANT, code: 'BUS_ATTENDANT' } },
      update: { systemCategory: 'ATTENDANT' },
      create: {
        id: randomUUID(),
        tenantId: TENANT,
        name: 'Bus Attendant',
        code: 'BUS_ATTENDANT',
        departmentId: dept.id,
        systemCategory: 'ATTENDANT',
        createdBy: SYSTEM,
        updatedBy: SYSTEM,
      },
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 2. STAFF — 6 Drivers (Employee + Driver)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  [2/7] Staff — 6 Drivers...');
    const driverIds: string[] = [];

    for (const p of DRIVER_PROFILES) {
      // Check if driver with this license already exists
      const existing = await tx.driver.findFirst({
        where: { tenantId: TENANT, licenseNumber: p.license, softDelete: false },
      });
      if (existing) {
        driverIds.push(existing.id);
        continue;
      }

      const empId = randomUUID();
      const drvId = randomUUID();
      await tx.employee.create({
        data: {
          id: empId,
          tenantId: TENANT,
          firstName: p.firstName,
          lastName: p.lastName,
          contactPhone: p.phone,
          email: p.email,
          departmentId: dept.id,
          roleId: driverRole.id,
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });
      await tx.driver.create({
        data: {
          id: drvId,
          tenantId: TENANT,
          employeeId: empId,
          licenseNumber: p.license,
          licenseExpiry: oneYearOut,
          badgeNumber: p.badge,
          badgeExpiry: oneYearOut,
          policeVerificationStatus: 'VERIFIED',
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });
      driverIds.push(drvId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. STAFF — 6 Attendants (Employee + Attendant)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  [3/7] Staff — 6 Attendants...');
    const attendantIds: string[] = [];

    for (const p of ATTENDANT_PROFILES) {
      const existing = await tx.attendant.findFirst({
        where: { tenantId: TENANT, employee: { contactPhone: p.phone }, softDelete: false },
      });
      if (existing) {
        attendantIds.push(existing.id);
        continue;
      }

      const empId = randomUUID();
      const attId = randomUUID();
      await tx.employee.create({
        data: {
          id: empId,
          tenantId: TENANT,
          firstName: p.firstName,
          lastName: p.lastName,
          contactPhone: p.phone,
          email: p.email,
          departmentId: dept.id,
          roleId: attendantRole.id,
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });
      await tx.attendant.create({
        data: {
          id: attId,
          tenantId: TENANT,
          employeeId: empId,
          policeVerificationStatus: 'VERIFIED',
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });
      attendantIds.push(attId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. FLEET — 6 Vehicles
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  [4/7] Fleet — 6 Vehicles...');
    const vehicleIds: string[] = [];

    for (const v of VEHICLES) {
      const existing = await tx.vehicle.findFirst({
        where: { tenantId: TENANT, registrationNo: v.reg, softDelete: false },
      });
      if (existing) {
        vehicleIds.push(existing.id);
        continue;
      }

      const vId = randomUUID();
      await tx.vehicle.create({
        data: {
          id: vId,
          tenantId: TENANT,
          registrationNo: v.reg,
          vehicleType: v.type,
          capacity: v.cap,
          insurancePolicyNo: v.insurance,
          insuranceExpiryDate: oneYearOut,
          fitnessCertificateNo: v.fitness,
          fitnessExpiryDate: oneYearOut,
          pucCertificateNo: v.puc,
          pucExpiryDate: sixMonthsOut,
          fireExtinguisherAvailable: true,
          firstAidAvailable: true,
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });
      vehicleIds.push(vId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. GEOGRAPHY — 20 Stops
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  [5/7] Geography — 20 Stops...');
    const stopIds: string[] = [];

    for (const s of STOPS) {
      const existing = await tx.stop.findFirst({
        where: { tenantId: TENANT, name: s.name, softDelete: false },
      });
      if (existing) {
        stopIds.push(existing.id);
        continue;
      }

      const sId = randomUUID();
      await tx.stop.create({
        data: {
          id: sId,
          tenantId: TENANT,
          name: s.name,
          landmark: s.landmark,
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });
      stopIds.push(sId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 6. ROUTES + TRIPS (5 Routes × 2 Trips each = 10 Trips)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  [6/7] Routes + Trips...');
    const routeRecords: { routeId: string; stops: number[] }[] = [];

    for (let ri = 0; ri < ROUTES.length; ri++) {
      const r = ROUTES[ri];

      const existing = await tx.transportRoute.findFirst({
        where: { tenantId: TENANT, code: r.code, softDelete: false },
      });
      if (existing) {
        routeRecords.push({ routeId: existing.id, stops: r.stops });
        continue;
      }

      const routeId = randomUUID();
      await tx.transportRoute.create({
        data: {
          id: routeId,
          tenantId: TENANT,
          code: r.code,
          name: r.name,
          description: r.desc,
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });

      // Morning trip — Vehicle index = ri (0–4 maps to 6 vehicles), +1 for evening
      // Round-robin assignment: no double-booking
      const morningVehicle = vehicleIds[ri % vehicleIds.length];
      const eveningVehicle = vehicleIds[ri % vehicleIds.length]; // same vehicle, different time

      // Driver/Attendant assignment: round-robin across 6 staff
      const morningDriver    = driverIds[ri % driverIds.length];
      const morningAttendant = attendantIds[ri % attendantIds.length];
      // Evening: offset by 1 to avoid same-time double booking (different driver)
      const eveningDriver    = driverIds[(ri + 1) % driverIds.length];
      const eveningAttendant = attendantIds[(ri + 1) % attendantIds.length];

      // Morning Pickup Trip
      await tx.routeTrip.create({
        data: {
          tenantId: TENANT,
          routeId,
          tripType: 'MORNING',
          startTime: '07:00',
          endTime: '08:00',
          vehicleId: morningVehicle,
          driverId: morningDriver,
          attendantId: morningAttendant,
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });

      // Evening Drop Trip
      await tx.routeTrip.create({
        data: {
          tenantId: TENANT,
          routeId,
          tripType: 'EVENING',
          startTime: '15:30',
          endTime: '16:30',
          vehicleId: eveningVehicle,
          driverId: eveningDriver,
          attendantId: eveningAttendant,
          createdBy: SYSTEM,
          updatedBy: SYSTEM,
        },
      });

      routeRecords.push({ routeId, stops: r.stops });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 7. SCHEDULES — RouteStops (4 stops per route with sequential times)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('  [7/7] Schedules — RouteStops...');

    for (const rec of routeRecords) {
      for (let seq = 0; seq < rec.stops.length; seq++) {
        const sId = stopIds[rec.stops[seq]];

        const existing = await tx.routeStop.findFirst({
          where: { routeId: rec.routeId, stopId: sId, softDelete: false },
        });
        if (existing) continue;

        await tx.routeStop.create({
          data: {
            tenantId: TENANT,
            routeId: rec.routeId,
            stopId: sId,
            sequence: seq + 1,
            distanceKm: (seq + 1) * 3.5, // incremental realistic distance
            pickupTime: MORNING_TIMES[seq],
            dropTime: EVENING_TIMES[seq],
            createdBy: SYSTEM,
            updatedBy: SYSTEM,
          },
        });
      }
    }
  });

  console.log('✅ Transport Master Seeder — Complete!');
  console.log('   6 Drivers, 6 Attendants, 6 Vehicles, 20 Stops, 5 Routes, 10 Trips, ~20 RouteStops');
}

main()
  .catch((e) => {
    console.error('❌ Transport Master Seeder FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
