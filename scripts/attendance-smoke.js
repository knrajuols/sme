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

  const tenantCode = `attendance-${Date.now()}`;
  const adminEmail = `admin+${tenantCode}@attendance.local`;

  const createdTenant = await assertHttp('http://localhost:3000/platform/tenants', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${platformToken}`,
      'content-type': 'application/json',
      'x-correlation-id': `attendance-smoke-${Date.now()}`,
    },
    body: JSON.stringify({
      tenantCode,
      schoolName: `Attendance Smoke ${tenantCode}`,
      primaryContactName: 'Attendance Admin',
      primaryContactEmail: adminEmail,
      primaryContactPhone: '+15550003333',
      status: 'active',
    }),
  });

  const tenantId = createdTenant.data?.tenantId;
  if (!tenantId) {
    throw new Error('Tenant creation failed for attendance smoke');
  }

  await sleep(5000);

  const schoolAdminToken = await requestToken(adminEmail);
  const headers = {
    authorization: `Bearer ${schoolAdminToken}`,
    'content-type': 'application/json',
    'x-correlation-id': `attendance-smoke-${Date.now()}`,
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
      name: 'Grade 2',
      code: 'G2',
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

  const students = [];
  for (let index = 0; index < 4; index += 1) {
    const student = await assertHttp('http://localhost:3002/academic/students', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        admissionNumber: `ATT-${Date.now()}-${index}`,
        firstName: `Student${index + 1}`,
        lastName: 'Test',
        dateOfBirth: '2016-07-11T00:00:00.000Z',
        gender: index % 2 === 0 ? 'MALE' : 'FEMALE',
        status: 'ACTIVE',
      }),
    });

    students.push(student.data.id);

    await assertHttp('http://localhost:3002/academic/students/enrollments', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        studentId: student.data.id,
        classId: klass.data.id,
        sectionId: section.data.id,
        academicYearId: year.data.id,
        rollNumber: `${index + 1}`,
      }),
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const session = await assertHttp('http://localhost:3002/attendance/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      date: `${today}T00:00:00.000Z`,
      classId: klass.data.id,
      sectionId: section.data.id,
      academicYearId: year.data.id,
    }),
  });

  const sessionId = session.data.id;
  const sessionDetails = await assertHttp(`http://localhost:3002/attendance/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
    },
  });

  const summaryFrom = today;
  const summaryTo = today;
  const sessionDate = new Date(sessionDetails.data.date).toISOString().slice(0, 10);
  const inRange = summaryFrom <= sessionDate && sessionDate <= summaryTo;
  if (!inRange) {
    throw new Error(`Session date ${sessionDate} is outside summary range ${summaryFrom}..${summaryTo}`);
  }

  const enrolledStudentIds = sessionDetails.data.enrolledStudentIds;
  if (!Array.isArray(enrolledStudentIds) || enrolledStudentIds.length === 0) {
    throw new Error('No enrolled students returned for attendance session');
  }

  const records = enrolledStudentIds.map((studentId, index) => ({
    studentId,
    status: index < Math.ceil(enrolledStudentIds.length / 2) ? 'PRESENT' : 'ABSENT',
  }));

  const marked = await assertHttp('http://localhost:3002/attendance/records', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId,
      records,
    }),
  });

  await assertHttp(`http://localhost:3002/attendance/sessions/${encodeURIComponent(sessionId)}/close`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
    },
  });

  const markAfterClose = await fetch('http://localhost:3002/attendance/records', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId,
      records: [{
        studentId: enrolledStudentIds[0],
        status: 'LATE',
      }],
    }),
  });

  if (markAfterClose.status < 400) {
    throw new Error('Marking after close unexpectedly succeeded');
  }

  const summary = await assertHttp(
    `http://localhost:3002/attendance/students/${encodeURIComponent(enrolledStudentIds[0])}/summary?from=${summaryFrom}&to=${summaryTo}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${schoolAdminToken}`,
      },
    },
  );

  const summaryStudentId = enrolledStudentIds[0];

  console.log(`sessionId=${sessionId}`);
  console.log(`recordCount=${marked.data.recordCount}`);
  console.log(`summaryStudentId=${summaryStudentId}`);
  console.log(`summaryFrom=${summaryFrom}`);
  console.log(`summaryTo=${summaryTo}`);
  console.log(`summarySessionDate=${sessionDate}`);
  console.log(`summaryDateInRange=${inRange}`);
  console.log(`summaryTotalDays=${summary.data.totalDays}`);
  console.log(`summaryPresentDays=${summary.data.presentDays}`);
  console.log(`summaryAbsentDays=${summary.data.absentDays}`);
  console.log(`summaryPercentage=${summary.data.percentage}`);
  console.log('attendance:smoke PASS');
}

void main().catch((error) => {
  console.error(`attendance:smoke FAIL: ${error.message}`);
  process.exitCode = 1;
});