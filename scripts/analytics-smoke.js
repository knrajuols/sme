const { spawnSync } = require('child_process');

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
  return match?.[1] ?? null;
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
  const examSmoke = spawnSync('npm', ['run', 'exam:smoke'], {
    shell: true,
    cwd: process.cwd(),
    encoding: 'utf-8',
  });

  if (examSmoke.status !== 0) {
    throw new Error(`exam:smoke prerequisite failed: ${examSmoke.stdout}\n${examSmoke.stderr}`);
  }

  const combinedOutput = `${examSmoke.stdout}\n${examSmoke.stderr}`;
  const examId = parseOutputValue(combinedOutput, 'examId');
  const adminEmail = parseOutputValue(combinedOutput, 'adminEmail');

  if (!examId || !adminEmail) {
    throw new Error(`Unable to parse examId/adminEmail from exam:smoke output: ${combinedOutput}`);
  }

  const schoolAdminToken = await requestToken(adminEmail);

  await assertHttp(`http://localhost:3002/exams/${encodeURIComponent(examId)}/publish`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${schoolAdminToken}`,
      'x-correlation-id': `analytics-smoke-${Date.now()}`,
    },
  });

  const classSummary = await assertHttp(
    `http://localhost:3002/analytics/exams/${encodeURIComponent(examId)}/class-summary`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${schoolAdminToken}`,
      },
    },
  );

  const rankings = await assertHttp(
    `http://localhost:3002/analytics/exams/${encodeURIComponent(examId)}/rankings`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${schoolAdminToken}`,
      },
    },
  );

  const subjectSummary = await assertHttp(
    `http://localhost:3002/analytics/exams/${encodeURIComponent(examId)}/subject-summary`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${schoolAdminToken}`,
      },
    },
  );

  const rankingRows = rankings.data ?? rankings;
  if (!Array.isArray(rankingRows) || rankingRows.length === 0) {
    throw new Error('No rankings returned from analytics endpoint');
  }

  const topRankStudent = rankingRows[0];
  const studentId = topRankStudent.studentId;

  const studentPerformance = await assertHttp(
    `http://localhost:3002/analytics/students/${encodeURIComponent(studentId)}/performance`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${schoolAdminToken}`,
      },
    },
  );

  const correlation = await assertHttp(
    `http://localhost:3002/analytics/students/${encodeURIComponent(studentId)}/correlation?examId=${encodeURIComponent(examId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${schoolAdminToken}`,
      },
    },
  );

  const classData = classSummary.data ?? classSummary;
  const subjectData = subjectSummary.data ?? subjectSummary;
  const performanceData = studentPerformance.data ?? studentPerformance;
  const correlationData = correlation.data ?? correlation;

  const samplePerformance = Array.isArray(performanceData)
    ? performanceData.find((item) => item.examId === examId) ?? performanceData[0]
    : null;

  console.log(`examId=${examId}`);
  console.log(`aggregateCount=${rankingRows.length}`);
  console.log(`rankingCount=${rankingRows.length}`);
  console.log(`classAverage=${classData.averagePercentage}`);
  console.log(`topRankStudent=${topRankStudent.studentId}`);
  console.log(`sampleStudentGPA=${samplePerformance?.gpa ?? 'n/a'}`);
  console.log(`correlationLabel=${correlationData.correlationLabel}`);
  console.log(`subjectSummaryCount=${Array.isArray(subjectData) ? subjectData.length : 0}`);
  console.log('analytics:smoke PASS');
}

void main().catch((error) => {
  console.error(`analytics:smoke FAIL: ${error.message}`);
  process.exitCode = 1;
});
