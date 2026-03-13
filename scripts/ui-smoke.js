async function main() {
  const checks = [
    { name: 'web-admin', url: 'http://localhost:3101/login' },
    { name: 'web-portal', url: 'http://localhost:3102/login' },
  ];

  for (const check of checks) {
    const response = await fetch(check.url);
    if (!response.ok) {
      throw new Error(`${check.name} failed at ${check.url}: ${response.status}`);
    }
  }

  console.log('ui:smoke PASS');
}

void main().catch((error) => {
  console.error(`ui:smoke FAIL: ${error.message}`);
  process.exitCode = 1;
});
