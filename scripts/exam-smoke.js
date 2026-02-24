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

function unwrap(body) {
  return body?.data ?? body;
}

async function requestToken(email) {
  const result = await assertHttp('http://localhost:3001/iam/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const token = unwrap(result)?.accessToken;
  if (!token) {
    throw new Error(`Failed to get token for ${email}`);
  }

  return token;
}

async function main() {
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'platform.admin@sme.local';
  const platformToken = await requestToken(platformAdminEmail);

  const tenantCode = `exam-${Date.now()}`;
  const adminEmail = `admin+${tenantCode}@exam.local`;

  const createdTenant = await assertHttp('http://localhost:3000/platform/tenants', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${platformToken}`,
      'content-type': 'application/json',
      'x-correlation-id': `exam-smoke-${Date.now()}`,
    },
    body: JSON.stringify({
      tenantCode,
      schoolName: `Exam Smoke ${tenantCode}`,
      primaryContactName: 'Exam Admin',
      primaryContactEmail: adminEmail,
      primaryContactPhone: '+15550004444',
      status: 'active',
    }),
  });

  const tenantId = unwrap(createdTenant)?.tenantId;
  if (!tenantId) {
    throw new Error(`Tenant creation failed: ${JSON.stringify(createdTenant)}`);
  }

  await sleep(5000);

  const schoolAdminToken = await requestToken(adminEmail);
  const headers = {
    authorization: `Bearer ${schoolAdminToken}`,
    'content-type': 'application/json',
    'x-correlation-id': `exam-smoke-${Date.now()}`,
  };

  const year = unwrap(await assertHttp('http://localhost:3002/academic/years', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: '2026-2027',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2027-03-31T23:59:59.999Z',
      isActive: true,
    }),
  }));

  const klass = unwrap(await assertHttp('http://localhost:3002/academic/classes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Grade 3',
      code: `G3-${Date.now().toString().slice(-4)}`,
      academicYearId: year.id,
    }),
  }));

  const section = unwrap(await assertHttp('http://localhost:3002/academic/sections', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'A',
      classId: klass.id,
    }),
  }));

  const subject = unwrap(await assertHttp('http://localhost:3002/academic/subjects', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Science',
      code: `SCI-${Date.now().toString().slice(-5)}`,
      classId: klass.id,
    }),
  }));

  const studentIds = [];
  for (let index = 0; index < 2; index += 1) {
    const student = unwrap(await assertHttp('http://localhost:3002/academic/students', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        admissionNumber: `EXM-${Date.now()}-${index}`,
        firstName: `ExamStudent${index + 1}`,
        lastName: 'Test',
        dateOfBirth: '2016-07-11T00:00:00.000Z',
        gender: index % 2 === 0 ? 'MALE' : 'FEMALE',
        status: 'ACTIVE',
      }),
    }));

    studentIds.push(student.id);

    await assertHttp('http://localhost:3002/academic/students/enrollments', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        studentId: student.id,
        classId: klass.id,
        sectionId: section.id,
        academicYearId: year.id,
        rollNumber: `${index + 1}`,
      }),
    });
  }

  const exam = unwrap(await assertHttp('http://localhost:3002/exams', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Mid Term',
      academicYearId: year.id,
      classId: klass.id,
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-15T00:00:00.000Z',
    }),
  }));

  await assertHttp(`http://localhost:3002/exams/${encodeURIComponent(exam.id)}/subjects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subjectId: subject.id,
      maxMarks: 100,
      weightage: 100,
    }),
  });

  await assertHttp(`http://localhost:3002/exams/${encodeURIComponent(exam.id)}/marks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subjectId: subject.id,
      marks: [
        { studentId: studentIds[0], marksObtained: 80 },
        { studentId: studentIds[1], marksObtained: 60 },
      ],
    }),
  });

  await assertHttp(`http://localhost:3002/exams/${encodeURIComponent(exam.id)}/verify`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
      'x-correlation-id': `exam-smoke-${Date.now()}`,
    },
  });

  const publish = unwrap(await assertHttp(`http://localhost:3002/exams/${encodeURIComponent(exam.id)}/publish`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
      'x-correlation-id': `exam-smoke-${Date.now()}`,
    },
  }));

  const republish = unwrap(await assertHttp(`http://localhost:3002/exams/${encodeURIComponent(exam.id)}/publish`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
      'x-correlation-id': `exam-smoke-${Date.now()}`,
    },
  }));

  if (publish.resultCount !== republish.resultCount) {
    throw new Error('Publish idempotency check failed: resultCount mismatch on re-publish');
  }

  const mutateAfterPublish = await fetch(`http://localhost:3002/exams/${encodeURIComponent(exam.id)}/subjects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subjectId: subject.id,
      maxMarks: 100,
    }),
  });

  if (mutateAfterPublish.status < 400) {
    throw new Error('Published exam was mutable; expected mutation rejection');
  }

  const examResults = unwrap(await assertHttp(`http://localhost:3002/exams/${encodeURIComponent(exam.id)}/results`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
    },
  }));

  const studentResults = unwrap(await assertHttp(
    `http://localhost:3002/students/${encodeURIComponent(studentIds[0])}/results`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${schoolAdminToken}`,
      },
    },
  ));

  const sampleResult = Array.isArray(studentResults) ? studentResults[0] : null;
  const resultCount = Array.isArray(examResults) ? examResults.length : 0;

  if (resultCount !== publish.resultCount) {
    throw new Error(`Result count mismatch: publish=${publish.resultCount}, fetched=${resultCount}`);
  }

  console.log(`tenantId=${tenantId}`);
  console.log(`examId=${exam.id}`);
  console.log(`adminEmail=${adminEmail}`);
  console.log(`resultCount=${resultCount}`);
  console.log(`sampleStudentResult=${JSON.stringify(sampleResult)}`);
  console.log('exam:smoke PASS');
}

void main().catch((error) => {
  console.error(`exam:smoke FAIL: ${error.message}`);
  process.exitCode = 1;
});
