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

async function requestToken(email) {
  const result = await assertHttp('http://localhost:3001/iam/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const token = result.data?.accessToken;
  if (!token) {
    throw new Error(`Failed to get token for ${email}`);
  }

  return token;
}

async function main() {
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'platform.admin@sme.local';
  const platformToken = await requestToken(platformAdminEmail);

  const tenantCode = `academic-${Date.now()}`;
  const adminEmail = `admin+${tenantCode}@academic.local`;
  const createTenant = await assertHttp('http://localhost:3000/platform/tenants', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${platformToken}`,
      'content-type': 'application/json',
      'x-correlation-id': `academic-smoke-${Date.now()}`,
    },
    body: JSON.stringify({
      tenantCode,
      schoolName: `Academic Smoke ${tenantCode}`,
      primaryContactName: 'Academic Admin',
      primaryContactEmail: adminEmail,
      primaryContactPhone: '+15550002222',
      status: 'active',
    }),
  });

  const tenantId = createTenant.data?.tenantId;
  if (!tenantId) {
    throw new Error(`Tenant creation failed: ${JSON.stringify(createTenant)}`);
  }

  await sleep(5000);

  const schoolAdminToken = await requestToken(adminEmail);
  const headers = {
    authorization: `Bearer ${schoolAdminToken}`,
    'x-correlation-id': `academic-smoke-${Date.now()}`,
    'content-type': 'application/json',
  };

  const year = await assertHttp('http://localhost:3002/academic/years', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: '2026-2027',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2027-03-31T23:59:59.999Z',
      isActive: true,
    }),
  });

  const klass = await assertHttp('http://localhost:3002/academic/classes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Grade 1',
      code: 'G1',
      academicYearId: year.data.id,
    }),
  });

  const section = await assertHttp('http://localhost:3002/academic/sections', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'A',
      classId: klass.data.id,
    }),
  });

  const subject = await assertHttp('http://localhost:3002/academic/subjects', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Mathematics',
      code: 'MATH',
      classId: klass.data.id,
    }),
  });

  const student = await assertHttp('http://localhost:3002/academic/students', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumber: `ADM-${Date.now()}`,
      firstName: 'Riya',
      lastName: 'Mehta',
      dateOfBirth: '2016-07-11T00:00:00.000Z',
      gender: 'FEMALE',
      status: 'ACTIVE',
    }),
  });

  const enrollment = await assertHttp('http://localhost:3002/academic/students/enrollments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      studentId: student.data.id,
      classId: klass.data.id,
      sectionId: section.data.id,
      academicYearId: year.data.id,
      rollNumber: '12',
    }),
  });

  console.log('Academic entity IDs:');
  console.log(`tenantId=${tenantId}`);
  console.log(`academicYearId=${year.data.id}`);
  console.log(`classId=${klass.data.id}`);
  console.log(`sectionId=${section.data.id}`);
  console.log(`subjectId=${subject.data.id}`);
  console.log(`studentId=${student.data.id}`);
  console.log(`enrollmentId=${enrollment.data.id}`);
  console.log('academic:smoke PASS');
}

void main().catch((error) => {
  console.error(`academic:smoke FAIL: ${error.message}`);
  process.exitCode = 1;
});