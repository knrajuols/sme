const { PrismaClient } = require('./src/generated/prisma-client');
BigInt.prototype.toJSON = function() { return this.toString(); };
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
  .then(r => {
    const names = r.map(x => x.table_name);
    console.log('Tables in sme_tenant DB (' + names.length + '):', names.join(', ') || 'NONE');
    return p.$disconnect();
  })
  .catch(e => { console.error('ERROR:', e.message); return p.$disconnect(); });
