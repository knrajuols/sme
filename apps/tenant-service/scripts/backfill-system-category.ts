/**
 * Backfill: Set systemCategory on existing EmployeeRole rows based on code patterns.
 * Run once after the enum column is added via `prisma db push`.
 */
import { PrismaClient } from '../src/generated/prisma-client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const drivers = await prisma.$executeRawUnsafe(
      `UPDATE "EmployeeRole" SET "systemCategory" = 'DRIVER' WHERE UPPER(code) LIKE '%DRV%' OR UPPER(code) LIKE '%DRIVER%'`,
    );
    const attendants = await prisma.$executeRawUnsafe(
      `UPDATE "EmployeeRole" SET "systemCategory" = 'ATTENDANT' WHERE UPPER(code) LIKE '%ATT%' OR UPPER(code) LIKE '%ATTENDANT%'`,
    );
    const teachers = await prisma.$executeRawUnsafe(
      `UPDATE "EmployeeRole" SET "systemCategory" = 'TEACHER' WHERE UPPER(code) LIKE '%TCHR%' OR UPPER(code) LIKE '%TEACHER%'`,
    );
    console.log('Backfill complete:', { drivers, attendants, teachers });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
