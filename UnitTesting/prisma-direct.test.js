/**
 * Direct Prisma DB test — run with:
 *   cd apps/tenant-service && node ../../UnitTesting/prisma-direct.test.js
 */
const { PrismaClient, SchoolStatus } = require('./src/generated/prisma-client');
const { randomUUID } = require('crypto');

async function run() {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://smeadmin:smeadmin123@localhost:5432/sme_tenant?schema=public',
      },
    },
  });

  try {
    // 1. Check basic DB connectivity
    const ping = await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log('DB Ping:', ping);
    // ... more test logic ...
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(console.error);
