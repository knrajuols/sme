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

async function main() {
  const correlationId = `smoke-${Date.now()}`;
  const tenantCode = `tenant-${Date.now()}`;
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'platform.admin@sme.local';

  const payload = {
    tenantCode,
    schoolName: 'Onboarding Smoke Academy',
    primaryContactName: 'Smoke Admin',
    primaryContactEmail: `admin+${Date.now()}@smoke.local`,
    primaryContactPhone: '+15550001111',
    status: 'active',
    planId: 'starter',
  };

  const tokenResponse = await assertHttp(
    'http://localhost:3001/iam/auth/token',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: platformAdminEmail }),
    },
  );

  const platformToken = tokenResponse.data?.accessToken;
  if (!platformToken) {
    throw new Error(`Failed to obtain platform token: ${JSON.stringify(tokenResponse)}`);
  }

  const createResponse = await assertHttp(
    'http://localhost:3000/platform/tenants',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${platformToken}`,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(payload),
    },
  );

  const tenantId = createResponse.data?.tenantId;
  const createdTenantCode = createResponse.data?.tenantCode;

  if (!tenantId || !createdTenantCode) {
    throw new Error(`Tenant create response missing identifiers: ${JSON.stringify(createResponse)}`);
  }

  console.log(`Tenant created: ${tenantId} (${createdTenantCode})`);

  await sleep(4000);

  const iamUsers = await assertHttp(
    'http://localhost:3001/iam/users',
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${platformToken}`,
        'x-tenant-id': tenantId,
      },
    },
  );

  const hasAdmin = Array.isArray(iamUsers.data)
    ? iamUsers.data.some((user) => user.email === payload.primaryContactEmail)
    : false;

  if (!hasAdmin) {
    throw new Error(`IAM admin user not found for tenant ${tenantId}`);
  }
  console.log('IAM admin verification: PASS');

  const modulesResponse = await assertHttp(
    `http://localhost:3003/configurations/${encodeURIComponent(tenantId)}/modules`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${platformToken}`,
      },
    },
  );

  const modules = modulesResponse.data?.modules;
  const hasAttendance = Array.isArray(modules)
    ? modules.some((item) => item.moduleKey === 'attendance' && item.enabled === true)
    : false;

  if (!hasAttendance) {
    throw new Error(`Config entitlements not seeded for tenant ${tenantId}`);
  }
  console.log('Config defaults verification: PASS');

  const auditResponse = await assertHttp(
    `http://localhost:3004/audits/tenant/${encodeURIComponent(tenantId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${platformToken}`,
      },
    },
  );

  const auditLogs = auditResponse.data;
  if (!Array.isArray(auditLogs) || auditLogs.length === 0) {
    throw new Error(`Audit logs not found for tenant ${tenantId}`);
  }

  console.log(`Audit verification: PASS (${auditLogs.length} logs)`);
  console.log('smoke:onboard PASS');
}

void main().catch((error) => {
  console.error(`smoke:onboard FAIL: ${error.message}`);
  process.exitCode = 1;
});
