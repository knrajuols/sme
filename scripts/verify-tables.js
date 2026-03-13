const { Client } = require('pg');

const dbs = ['sme_tenant', 'sme_iam', 'sme_audit', 'sme_config'];
const base = { host: 'localhost', port: 5432, user: 'postgres', password: 'Olsbook55' };

(async () => {
  const results = [];
  for (const db of dbs) {
    const c = new Client({ ...base, database: db });
    await c.connect();
    const r = await c.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename"
    );
    results.push({ db, count: r.rows.length, tables: r.rows.map(row => row.tablename) });
    await c.end();
  }

  console.log('\n========================================');
  console.log('  DATABASE TABLE VERIFICATION REPORT');
  console.log('========================================');
  console.log(('Database').padEnd(16) + ('App Tables').padEnd(14) + 'Table Names');
  console.log('-'.repeat(72));
  for (const { db, count, tables } of results) {
    console.log(db.padEnd(16) + String(count).padEnd(14) + tables.join(', '));
  }
  console.log('========================================\n');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
