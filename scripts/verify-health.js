const services = [
  { name: 'iam-service', url: process.env.IAM_HEALTH_URL ?? 'http://localhost:3001/health/ready' },
  { name: 'tenant-service', url: process.env.TENANT_HEALTH_URL ?? 'http://localhost:3002/health/ready' },
  { name: 'config-service', url: process.env.CONFIG_HEALTH_URL ?? 'http://localhost:3003/health/ready' },
  { name: 'audit-service', url: process.env.AUDIT_HEALTH_URL ?? 'http://localhost:3004/health/ready' },
  { name: 'portal-service', url: process.env.PORTAL_HEALTH_URL ?? 'http://localhost:3005/health/ready' },
  { name: 'api-gateway', url: process.env.GATEWAY_HEALTH_URL ?? 'http://localhost:3000/health/ready' },
];

async function checkService(service) {
  try {
    const response = await fetch(service.url, { method: 'GET' });
    if (response.ok) {
      return { ...service, ok: true, status: response.status };
    }

    return { ...service, ok: false, status: response.status };
  } catch (error) {
    return {
      ...service,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const results = await Promise.all(services.map(checkService));

  let hasFailure = false;
  for (const result of results) {
    if (result.ok) {
      console.log(`PASS ${result.name} (${result.url}) [${result.status}]`);
      continue;
    }

    hasFailure = true;
    if (result.error) {
      console.log(`FAIL ${result.name} (${result.url}) [${result.error}]`);
    } else {
      console.log(`FAIL ${result.name} (${result.url}) [HTTP ${result.status}]`);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

void main();
