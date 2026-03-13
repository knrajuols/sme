/**
 * Direct tenant-service call with JWT — reveals the actual internal error.
 * Run from repo root: node "UnitTesting/tenant-direct.test.js"
 */
const { createSign } = require('crypto');

const JWT_SECRET = 'sme-dev-jwt-secret';
const TENANT_SVC = 'http://localhost:3002';

// Manual JWT generation (HS256)
function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data   = `${header}.${body}`;
  const { createHmac } = require('crypto');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return res.json();
}

(async () => {
  // Example usage
  const jwt = signJwt({ sub: 'test-user', role: 'admin' }, JWT_SECRET);
  const result = await post(`${TENANT_SVC}/some-endpoint`, { foo: 'bar' }, { Authorization: `Bearer ${jwt}` });
  console.log(result);
})();
