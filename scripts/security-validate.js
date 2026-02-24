const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function assertHttp(url, options = {}) {
  const response = await fetch(url, options);
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${url} failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}

async function requestToken(email, tenantId) {
  const body = { email };
  if (tenantId) {
    body.tenantId = tenantId;
  }

  const response = await assertHttp('http://localhost:3001/iam/auth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return response.data?.accessToken;
}

async function createTenant(platformToken, suffix) {
  const tenantCode = `security-${suffix}-${Date.now()}`;
  const adminEmail = `admin+${tenantCode}@security.local`;

  const payload = {
    tenantCode,
    schoolName: `Security Tenant ${suffix}`,
    primaryContactName: `Admin ${suffix}`,
    primaryContactEmail: adminEmail,
    primaryContactPhone: '+15550001111',
    status: 'active',
    planId: 'starter',
  };

  const response = await assertHttp('http://localhost:3000/platform/tenants', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${platformToken}`,
      'x-correlation-id': `security-${suffix}-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  return {
    tenantId: response.data.tenantId,
    tenantCode: response.data.tenantCode,
    adminEmail,
  };
}

async function main() {
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'platform.admin@sme.local';
  const summary = {
    crossTenantDenied: false,
    impersonationSucceeded: false,
    auditLogCount: 0,
  };

  const platformToken = await requestToken(platformAdminEmail, 'platform');
  if (!platformToken) {
    throw new Error('Platform token issuance failed');
  }

  const tenantA = await createTenant(platformToken, 'a');
  const tenantB = await createTenant(platformToken, 'b');
  console.log(`Tenant A created: ${tenantA.tenantId}`);
  console.log(`Tenant B created: ${tenantB.tenantId}`);

  await sleep(5000);

  const tenantAdminToken = await requestToken(tenantA.adminEmail, tenantA.tenantId);
  if (!tenantAdminToken) {
    throw new Error('Tenant A admin token issuance failed');
  }

  const crossTenantResponse = await fetch(
    `http://localhost:3003/configurations/${encodeURIComponent(tenantB.tenantId)}/modules`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${tenantAdminToken}`,
      },
    },
  );

  summary.crossTenantDenied = crossTenantResponse.status === 403;

  const impersonationResponse = await fetch('http://localhost:3001/iam/users', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${platformToken}`,
      'x-tenant-id': tenantB.tenantId,
    },
  });

  summary.impersonationSucceeded = impersonationResponse.status === 200;

  const auditA = await assertHttp(
    `http://localhost:3004/audits/tenant/${encodeURIComponent(tenantA.tenantId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${platformToken}`,
      },
    },
  );

  const auditB = await assertHttp(
    `http://localhost:3004/audits/tenant/${encodeURIComponent(tenantB.tenantId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${platformToken}`,
      },
    },
  );

  summary.auditLogCount =
    (Array.isArray(auditA.data) ? auditA.data.length : 0) +
    (Array.isArray(auditB.data) ? auditB.data.length : 0);

  console.log(`Cross-tenant protection: ${summary.crossTenantDenied ? 'PASS' : 'FAIL'}`);
  console.log(`Platform impersonation: ${summary.impersonationSucceeded ? 'PASS' : 'FAIL'}`);
  console.log(`Audit log count: ${summary.auditLogCount}`);

  if (!summary.crossTenantDenied || !summary.impersonationSucceeded) {
    console.log('security:validate FAIL');
    process.exitCode = 1;
    return;
  }

  console.log('security:validate PASS');
}

void main().catch((error) => {
  console.error(`security:validate FAIL: ${error.message}`);
  process.exitCode = 1;
});