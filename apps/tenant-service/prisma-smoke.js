/**
 * Direct Prisma tenant-service create test.
 * Run from apps/tenant-service directory:
 *   $env:DATABASE_URL="postgresql://postgres:Olsbook55@localhost:5432/sme_tenant?schema=public"
 *   node prisma-smoke.js
 */
const { PrismaClient, SchoolStatus } = require('./src/generated/prisma-client');
const { randomUUID } = require('crypto');

// Fix BigInt serialization for JSON.stringify
BigInt.prototype.toJSON = function() { return this.toString(); };

const prisma = new PrismaClient();

async function run() {
  try {
    // 1. Basic connectivity
    const ping = await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log('[1] DB ping OK:', JSON.stringify(ping));

    // 2. Verify Tenant table
    const tableCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as cnt FROM information_schema.tables 
      WHERE table_name = 'Tenant' AND table_schema = 'public'
    `;
    console.log('[2] Tenant table:', JSON.stringify(tableCheck));

    // 3. Verify SchoolStatus enum
    const enumCheck = await prisma.$queryRaw`
      SELECT enumlabel FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'SchoolStatus'
    `;
    console.log('[3] SchoolStatus enum values:', JSON.stringify(enumCheck));

    // 4. Attempt Prisma create
    const code = 'smoke-' + Date.now();
    console.log('[4] Creating tenant with code:', code);
    const saved = await prisma.tenant.create({
      data: {
        id:           randomUUID(),
        code,
        name:         'Smoke Test School',
        schoolStatus: SchoolStatus.PENDING,
        udiseCode:    null,
        address:      null,
        city:         null,
        state:        null,
        pincode:      null,
        contactPhone: null,
        contactEmail: 'smoke@test.com',
        createdAt:    new Date(),
        updatedAt:    new Date(),
      },
      select: { id: true, code: true, name: true },
    });
    console.log('[4] CREATE SUCCESS:', JSON.stringify(saved));

    // 5. Cleanup
    await prisma.tenant.delete({ where: { code } });
    console.log('[5] Cleaned up record');
    console.log('\nAll checks passed — Prisma create is working correctly.');

  } catch (err) {
    console.error('\nFAIL MESSAGE:', err.message);
    console.error('FAIL CODE:   ', err.code);
    console.error('FAIL META:   ', JSON.stringify(err.meta));
    // Print stack for non-Prisma errors
    if (!err.code) console.error('STACK:', err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

run();
