/**
 * run-backfill.ts — Executes the password backfill directly via Prisma.
 * ──────────────────────────────────────────────────────────────────────────────
 * One-time script to hash DOB passwords for all employees with null passwordHash.
 * Run: npx ts-node scripts/run-backfill.ts
 */
const bcrypt = require('bcrypt');
const { PrismaClient } = require('../src/generated/prisma-client');

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_DOB_PLAINTEXT = '01011990';

async function main() {
  const prisma = new PrismaClient();
  try {
    const employees = await prisma.employee.findMany({
      where: { passwordHash: null, softDelete: false },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
    });

    console.log(`Found ${employees.length} employees without passwordHash\n`);

    let updated = 0;
    let skipped = 0;

    for (const emp of employees) {
      try {
        let plaintext;

        if (emp.dateOfBirth) {
          const d = new Date(emp.dateOfBirth);
          if (isNaN(d.getTime())) {
            plaintext = DEFAULT_DOB_PLAINTEXT;
            console.log(`  [WARN] Invalid DOB for ${emp.firstName} ${emp.lastName ?? ''} (${emp.id}) — using default`);
          } else {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = String(d.getFullYear());
            plaintext = `${dd}${mm}${yyyy}`;
          }
        } else {
          plaintext = DEFAULT_DOB_PLAINTEXT;
          console.log(`  [INFO] No DOB for ${emp.firstName} ${emp.lastName ?? ''} (${emp.id}) — using default`);
        }

        const hash = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);

        await prisma.employee.update({
          where: { id: emp.id },
          data: {
            passwordHash: hash,
            requiresPasswordChange: true,
          },
        });

        updated++;
        console.log(`  [OK] ${emp.firstName} ${emp.lastName ?? ''} — password set (plain: ${plaintext})`);
      } catch (err) {
        skipped++;
        console.error(`  [FAIL] ${emp.firstName} ${emp.lastName ?? ''} — ${err.message}`);
      }
    }

    console.log(`\n=== BACKFILL COMPLETE ===`);
    console.log(`Total: ${employees.length}, Updated: ${updated}, Skipped: ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
