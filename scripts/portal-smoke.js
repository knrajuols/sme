const { spawnSync } = require('child_process');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

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

function parseOutputValue(output, key) {
  const regex = new RegExp(`${key}=([^\r\n]+)`);
  const match = output.match(regex);
  return match?.[1]?.trim() ?? null;
}

function unwrap(body) {
  return body?.data ?? body;
}

async function requestToken(email) {
  const tokenResponse = await assertHttp('http://localhost:3001/iam/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const token = unwrap(tokenResponse)?.accessToken;
  if (!token) {
    throw new Error(`Token not issued for ${email}`);
  }

  return token;
}

async function main() {
  const examSmoke = spawnSync('npm', ['run', 'exam:smoke'], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    shell: true,
  });

  if (examSmoke.status !== 0) {
    const failureMessage = examSmoke.error?.message ?? 'unknown spawn error';
    throw new Error(`exam:smoke prerequisite failed:\n${examSmoke.stdout ?? ''}\n${examSmoke.stderr ?? ''}\n${failureMessage}`);
  }

  const output = `${examSmoke.stdout}\n${examSmoke.stderr}`;
  const examId = parseOutputValue(output, 'examId');
  const tenantId = parseOutputValue(output, 'tenantId');
  const adminEmail = parseOutputValue(output, 'adminEmail');

  if (!examId || !tenantId || !adminEmail) {
    throw new Error(`Unable to parse exam smoke output: ${output}`);
  }

  const schoolAdminToken = await requestToken(adminEmail);

  const examResults = unwrap(await assertHttp(`http://localhost:3002/exams/${encodeURIComponent(examId)}/results`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
    },
  }));

  if (!Array.isArray(examResults) || examResults.length === 0) {
    throw new Error('No exam results available to map parent');
  }

  const mappedStudentId = examResults[0].studentId;

  const parentEmail = `parent+${Date.now()}@portal.local`;
  await assertHttp('http://localhost:3001/iam/users', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: parentEmail,
      fullName: 'Portal Parent',
    }),
  });

  const users = unwrap(await assertHttp('http://localhost:3001/iam/users', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
    },
  }));

  const parentUser = Array.isArray(users)
    ? users.find((user) => user.email.toLowerCase() === parentEmail.toLowerCase())
    : null;

  if (!parentUser?.id) {
    throw new Error('Parent user not found after creation');
  }

  await assertHttp(`http://localhost:3001/iam/users/${encodeURIComponent(parentUser.id)}/roles/PARENT`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
    },
  });

  const prisma = new PrismaClient();
  const parentId = randomUUID();

  try {
    await prisma.$executeRaw`
      INSERT INTO "Parent" (
        "id", "tenantId", "userId", "firstName", "lastName", "phone", "email", "relation",
        "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${parentId}, ${tenantId}, ${parentUser.id}, ${'Portal'}, ${'Parent'}, ${'+15550005555'}, ${parentEmail}, ${'FATHER'},
        ${parentUser.id}, ${parentUser.id}, false, ${new Date()}, ${new Date()}
      )
      ON CONFLICT ("id") DO NOTHING
    `;

    await prisma.$executeRaw`
      INSERT INTO "ParentStudentMapping" (
        "id", "tenantId", "parentId", "studentId", "createdBy", "updatedBy", "softDelete", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${tenantId}, ${parentId}, ${mappedStudentId}, ${parentUser.id}, ${parentUser.id}, false, ${new Date()}, ${new Date()}
      )
      ON CONFLICT ("tenantId", "parentId", "studentId") DO NOTHING
    `;
  } finally {
    await prisma.$disconnect();
  }

  const parentToken = await requestToken(parentEmail);

  const profile = unwrap(await assertHttp('http://localhost:3005/portal/profile', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${parentToken}`,
      'x-correlation-id': `portal-smoke-${Date.now()}`,
    },
  }));

  const students = unwrap(await assertHttp('http://localhost:3005/portal/students', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${parentToken}`,
      'x-correlation-id': `portal-smoke-${Date.now()}`,
    },
  }));

  const attendance = unwrap(await assertHttp(`http://localhost:3005/portal/students/${encodeURIComponent(mappedStudentId)}/attendance`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${parentToken}`,
      'x-correlation-id': `portal-smoke-${Date.now()}`,
    },
  }));

  const results = unwrap(await assertHttp(`http://localhost:3005/portal/students/${encodeURIComponent(mappedStudentId)}/results`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${parentToken}`,
      'x-correlation-id': `portal-smoke-${Date.now()}`,
    },
  }));

  const dashboard = unwrap(await assertHttp(`http://localhost:3005/portal/students/${encodeURIComponent(mappedStudentId)}/analytics`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${parentToken}`,
      'x-correlation-id': `portal-smoke-${Date.now()}`,
    },
  }));

  const forbiddenWrite = await fetch('http://localhost:3005/portal/profile', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${parentToken}`,
      'content-type': 'application/json',
      'x-correlation-id': `portal-smoke-${Date.now()}`,
    },
    body: JSON.stringify({ test: true }),
  });

  if (forbiddenWrite.status < 400) {
    throw new Error('Forbidden write expectation failed: POST /portal/profile unexpectedly succeeded');
  }

  if (!profile?.id || !Array.isArray(students) || students.length === 0) {
    throw new Error('Portal profile or students response invalid');
  }

  if (!attendance || !Array.isArray(results) || !dashboard) {
    throw new Error('Portal attendance/results/analytics responses invalid');
  }

  console.log(`parentId=${parentId}`);
  console.log(`mappedStudentId=${mappedStudentId}`);
  console.log(`dashboardSample=${JSON.stringify(dashboard)}`);
  console.log('portal:smoke PASS');
}

void main().catch((error) => {
  console.error(`portal:smoke FAIL: ${error.message}`);
  process.exitCode = 1;
});
