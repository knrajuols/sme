// @ts-nocheck — Migration script already executed; schema has since made employeeId required.
/**
 * migrate-employee-backbone.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 3 — Data Migration: Unified Employee Backbone (COMPLETED)
 *
 * This script:
 *   1. Seeds default Departments (Academics, Transport, Administration) per tenant
 *   2. Seeds default EmployeeRoles (Senior Teacher, Teacher, Bus Driver, Attendant) per tenant
 *   3. Migrates every existing Teacher → creates Employee record, links back
 *   4. Migrates every existing Driver  → creates Employee record, links back
 *   5. Migrates every existing Attendant → creates Employee record, links back
 *
 * All operations are wrapped in a database transaction per tenant to ensure
 * zero data loss.  Safe to run multiple times (idempotent — skips already-linked records).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/migrate-employee-backbone.ts
 */

import { PrismaClient } from '../generated/prisma-client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ── Default seed data ────────────────────────────────────────────────────────

const DEFAULT_DEPARTMENTS = [
  { name: 'Academics',      code: 'ACAD' },
  { name: 'Transport',      code: 'TRNS' },
  { name: 'Administration', code: 'ADMN' },
];

const DEFAULT_ROLES = [
  { name: 'Senior Teacher', code: 'SR_TCHR' },
  { name: 'Teacher',        code: 'TCHR' },
  { name: 'Bus Driver',     code: 'DRVR' },
  { name: 'Bus Attendant',  code: 'ATTN' },
];

async function main() {
  console.log('═══ Employee Backbone Migration — START ═══');

  // Discover all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { softDelete: false },
    select: { id: true, code: true },
  });

  console.log(`Found ${tenants.length} tenant(s) to migrate.`);

  for (const tenant of tenants) {
    console.log(`\n── Tenant: ${tenant.code} (${tenant.id}) ──`);

    await prisma.$transaction(async (tx) => {
      // ── Task A: Seed Departments ────────────────────────────────────────
      const departmentMap: Record<string, string> = {};
      for (const dept of DEFAULT_DEPARTMENTS) {
        const existing = await tx.department.findUnique({
          where: { tenantId_code: { tenantId: tenant.id, code: dept.code } },
        });
        if (existing) {
          departmentMap[dept.code] = existing.id;
          console.log(`  [SKIP] Department "${dept.name}" already exists.`);
        } else {
          const id = randomUUID();
          await tx.department.create({
            data: {
              id,
              tenantId: tenant.id,
              name: dept.name,
              code: dept.code,
              createdBy: 'MIGRATION',
              updatedBy: 'MIGRATION',
            },
          });
          departmentMap[dept.code] = id;
          console.log(`  [CREATED] Department "${dept.name}" → ${id}`);
        }
      }

      // ── Task A: Seed Roles ──────────────────────────────────────────────
      const roleMap: Record<string, string> = {};
      for (const role of DEFAULT_ROLES) {
        const existing = await tx.employeeRole.findUnique({
          where: { tenantId_code: { tenantId: tenant.id, code: role.code } },
        });
        if (existing) {
          roleMap[role.code] = existing.id;
          console.log(`  [SKIP] Role "${role.name}" already exists.`);
        } else {
          const id = randomUUID();
          await tx.employeeRole.create({
            data: {
              id,
              tenantId: tenant.id,
              name: role.name,
              code: role.code,
              createdBy: 'MIGRATION',
              updatedBy: 'MIGRATION',
            },
          });
          roleMap[role.code] = id;
          console.log(`  [CREATED] Role "${role.name}" → ${id}`);
        }
      }

      // ── Task B: Migrate Teachers ────────────────────────────────────────
      const teachers = await tx.teacher.findMany({
        where: { tenantId: tenant.id, employeeId: null },
      });
      console.log(`  Teachers to migrate: ${teachers.length}`);

      for (const t of teachers) {
        const empId = randomUUID();
        // Derive name from employeeCode if original PII columns were already dropped
        const firstName = (t as Record<string, unknown>).firstName as string | null || t.employeeCode;
        const lastName  = (t as Record<string, unknown>).lastName  as string | null || null;
        const email     = (t as Record<string, unknown>).email     as string | null || null;
        const phone     = (t as Record<string, unknown>).contactPhone as string | null || null;

        // Assign "Senior Teacher" role if designation contains "Senior", else "Teacher"
        const roleCode = t.designation?.toLowerCase().includes('senior') ? 'SR_TCHR' : 'TCHR';

        await tx.employee.create({
          data: {
            id: empId,
            tenantId: tenant.id,
            firstName,
            lastName,
            email,
            contactPhone: phone,
            departmentId: departmentMap['ACAD'],
            roleId: roleMap[roleCode],
            isActive: t.isActive,
            createdBy: 'MIGRATION',
            updatedBy: 'MIGRATION',
          },
        });

        await tx.teacher.update({
          where: { id: t.id },
          data: { employeeId: empId },
        });

        console.log(`    [MIGRATED] Teacher ${t.employeeCode} → Employee ${empId}`);
      }

      // ── Task B: Migrate Drivers ─────────────────────────────────────────
      const drivers = await tx.driver.findMany({
        where: { tenantId: tenant.id, employeeId: null },
      });
      console.log(`  Drivers to migrate: ${drivers.length}`);

      for (const d of drivers) {
        const empId = randomUUID();
        // Driver had 'name' (single field) and 'mobile' — now dropped from schema
        const name = (d as Record<string, unknown>).name as string | null || 'Driver';
        const mobile = (d as Record<string, unknown>).mobile as string | null || null;

        await tx.employee.create({
          data: {
            id: empId,
            tenantId: tenant.id,
            firstName: name,
            lastName: null,
            email: null,
            contactPhone: mobile,
            departmentId: departmentMap['TRNS'],
            roleId: roleMap['DRVR'],
            isActive: d.isActive,
            createdBy: 'MIGRATION',
            updatedBy: 'MIGRATION',
          },
        });

        await tx.driver.update({
          where: { id: d.id },
          data: { employeeId: empId },
        });

        console.log(`    [MIGRATED] Driver ${d.licenseNumber} → Employee ${empId}`);
      }

      // ── Task B: Migrate Attendants ──────────────────────────────────────
      const attendants = await tx.attendant.findMany({
        where: { tenantId: tenant.id, employeeId: null },
      });
      console.log(`  Attendants to migrate: ${attendants.length}`);

      for (const a of attendants) {
        const empId = randomUUID();
        const name = (a as Record<string, unknown>).name as string | null || 'Attendant';
        const mobile = (a as Record<string, unknown>).mobile as string | null || null;

        await tx.employee.create({
          data: {
            id: empId,
            tenantId: tenant.id,
            firstName: name,
            lastName: null,
            email: null,
            contactPhone: mobile,
            departmentId: departmentMap['TRNS'],
            roleId: roleMap['ATTN'],
            isActive: a.isActive,
            createdBy: 'MIGRATION',
            updatedBy: 'MIGRATION',
          },
        });

        await tx.attendant.update({
          where: { id: a.id },
          data: { employeeId: empId },
        });

        console.log(`    [MIGRATED] Attendant ${a.id} → Employee ${empId}`);
      }
    });

    console.log(`  ✔ Tenant ${tenant.code} migration committed.`);
  }

  console.log('\n═══ Employee Backbone Migration — COMPLETE ═══');
}

main()
  .catch((err) => {
    console.error('Migration FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
