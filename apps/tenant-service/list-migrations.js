const { PrismaClient } = require('./src/generated/prisma-client');
BigInt.prototype.toJSON = function() { return this.toString(); };
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at")
  .then(r => {
    console.log('Applied migrations:');
    r.forEach(m => console.log(' -', m.migration_name, '|', m.finished_at ? 'OK' : 'FAILED'));
    return p.$disconnect();
  })
  .catch(e => { console.error('ERROR:', e.message); return p.$disconnect(); });
