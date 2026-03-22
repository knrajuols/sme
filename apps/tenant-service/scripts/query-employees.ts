/**
 * Temporary script to query tenants and employees for testing the backfill.
 * Run: npx ts-node --compiler-options '{"strict":false}' scripts/query-employees.ts
 */
const { PrismaClient } = require('../src/generated/prisma-client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // Get tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, code: true, name: true },
      take: 5,
    });
    console.log('=== TENANTS ===');
    console.log(JSON.stringify(tenants, null, 2));

    // Get employees without passwordHash
    const noPassword = await prisma.employee.findMany({
      where: { passwordHash: null, softDelete: false },
      select: { id: true, firstName: true, lastName: true, contactPhone: true, dateOfBirth: true, tenantId: true },
      take: 10,
    });
    console.log('\n=== EMPLOYEES WITHOUT PASSWORD ===');
    console.log(JSON.stringify(noPassword, null, 2));

    // Get employees with passwordHash
    const withPassword = await prisma.employee.findMany({
      where: { passwordHash: { not: null }, softDelete: false },
      select: { id: true, firstName: true, lastName: true, contactPhone: true, requiresPasswordChange: true, tenantId: true },
      take: 10,
    });
    console.log('\n=== EMPLOYEES WITH PASSWORD ===');
    console.log(JSON.stringify(withPassword, null, 2));

    // Count totals
    const totalNoPassword = await prisma.employee.count({ where: { passwordHash: null, softDelete: false } });
    const totalWithPassword = await prisma.employee.count({ where: { passwordHash: { not: null }, softDelete: false } });
    console.log(`\n=== COUNTS === No password: ${totalNoPassword}, With password: ${totalWithPassword}`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
