/**
 * Issue-247: Marks Seeder — Ammulu Public School, Unit Test 1
 *
 * Seeds realistic marks for all students in Class 10 (Section A: 40, Section B: 42)
 * across 6 subjects — Telugu, Hindi, English, Mathematics, Science, Social Studies
 * each with maxMarks = 25.
 *
 * Distribution:
 *  - Absence rate ≈ 2% (~1–2 students absent per subject out of 82)
 *  - Per-subject weighted bands produce distinct averages (15–22):
 *      Telugu ≈21, Hindi ≈19, English ≈18, Social Studies ≈17, Science ≈16, Maths ≈15
 *
 * Usage:
 *   cd apps/tenant-service
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-ammulu-marks.ts
 *
 * Wipes and recreates all StudentMark rows for this exam (idempotent reset).
 */

import { PrismaClient } from '../generated/prisma-client';
import { randomUUID } from 'crypto';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:Olsbook55@localhost:5432/sme_tenant?schema=public';

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const TENANT_ID    = '08dec606-4f1b-425e-a668-be14993c2587';
const EXAM_ID      = 'fa305e59-6700-47a1-9d09-d7e52b3d732e';
const CLASS_ID     = '73ee5dc9-be3c-4c37-9c87-c1da4d9a5c38';
const SECTION_A_ID = '2442015f-52f1-4dce-b8c3-3dea8483d9bc';
const SECTION_B_ID = 'e289a78b-3445-4abe-a494-3954afbb680d';

// Band: [minMark, maxMark, cumulativeWeight 0–100]
type Band = [number, number, number];

interface SubjectProfile {
  name:          string;
  examSubjectId: string;
  subjectId:     string;
  maxMarks:      number;
  absentRate:    number;
  bands:         Band[];
}

const EXAM_SUBJECTS: SubjectProfile[] = [
  {
    name: 'Telugu',
    examSubjectId: '70722a03-9f71-4831-9fe9-d6dec1538a94',
    subjectId:     '73a1d155-4ce8-4b69-8fec-fae4b79df121',
    maxMarks: 25, absentRate: 0.02,
    bands: [[8, 13, 5], [14, 18, 20], [19, 22, 45], [23, 25, 100]],
  },
  {
    name: 'Hindi',
    examSubjectId: '8d2d0915-559f-4a03-8bdf-c42d50e6c737',
    subjectId:     'fae6d254-0573-4711-9d12-18d1435a3fbb',
    maxMarks: 25, absentRate: 0.02,
    bands: [[8, 12, 8], [13, 17, 30], [18, 21, 65], [22, 25, 100]],
  },
  {
    name: 'English',
    examSubjectId: 'bdfb99b2-4b56-4a01-ba4c-05dcfbe9c9a9',
    subjectId:     '71750649-224a-4662-a98b-6461502d1ad5',
    maxMarks: 25, absentRate: 0.02,
    bands: [[8, 12, 10], [13, 17, 38], [18, 21, 72], [22, 25, 100]],
  },
  {
    name: 'Social Studies',
    examSubjectId: 'd3e00169-5874-473f-9a00-576d90ec6384',
    subjectId:     '73680b1b-f262-4467-b9e5-43db11a74c34',
    maxMarks: 25, absentRate: 0.02,
    bands: [[8, 12, 15], [13, 17, 50], [18, 21, 80], [22, 25, 100]],
  },
  {
    name: 'Science',
    examSubjectId: '109a8222-1f15-4d3d-bb3e-7ae0d7caa6f7',
    subjectId:     'f2033a98-8b08-4419-86e3-fef0530a70ea',
    maxMarks: 25, absentRate: 0.02,
    bands: [[8, 12, 20], [13, 17, 55], [18, 21, 82], [22, 25, 100]],
  },
  {
    name: 'Mathematics',
    examSubjectId: '3904ea67-050a-4f56-9122-83aa16f7008d',
    subjectId:     '09bf5790-2c2f-4de4-b91d-fb8e25e28490',
    maxMarks: 25, absentRate: 0.02,
    bands: [[8, 12, 28], [13, 17, 60], [18, 21, 85], [22, 25, 100]],
  },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickMark(bands: Band[]): number {
  const roll = Math.random() * 100;
  for (const [min, max, cumW] of bands) {
    if (roll <= cumW) return randInt(min, max);
  }
  const last = bands[bands.length - 1];
  return randInt(last[0], last[1]);
}

async function main() {
  console.log('=== Ammulu Marks Seeder — Unit Test 1 (wipe + reseed) ===\n');

  const deleted = await prisma.studentMark.deleteMany({
    where: { tenantId: TENANT_ID, examId: EXAM_ID },
  });
  console.log(`  Wiped ${deleted.count} existing mark records\n`);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      tenantId:  TENANT_ID,
      classId:   CLASS_ID,
      sectionId: { in: [SECTION_A_ID, SECTION_B_ID] },
      softDelete: false,
    },
    select: { studentId: true, sectionId: true },
    orderBy: [{ sectionId: 'asc' }, { createdAt: 'asc' }],
  });

  const secACount = enrollments.filter((e) => e.sectionId === SECTION_A_ID).length;
  const secBCount = enrollments.filter((e) => e.sectionId === SECTION_B_ID).length;
  console.log(`Found ${enrollments.length} students  (Section A: ${secACount}, Section B: ${secBCount})\n`);

  let totalCreated = 0;

  for (const subject of EXAM_SUBJECTS) {
    const records = enrollments.map((enr) => {
      const absent        = Math.random() < subject.absentRate;
      const marksObtained = absent ? 0 : pickMark(subject.bands);
      return {
        id:            randomUUID(),
        tenantId:      TENANT_ID,
        examId:        EXAM_ID,
        subjectId:     subject.subjectId,
        studentId:     enr.studentId,
        marksObtained,
        remarks:       absent ? 'ABSENT' : null,
        createdAt:     new Date(),
        updatedAt:     new Date(),
      };
    });

    await prisma.studentMark.createMany({ data: records });
    totalCreated += records.length;

    const absentCount = records.filter((r) => r.remarks === 'ABSENT').length;
    const present     = records.filter((r) => r.remarks !== 'ABSENT');
    const avg         = present.length
      ? (present.reduce((s, r) => s + r.marksObtained, 0) / present.length).toFixed(1)
      : 'N/A';
    const hi = present.length ? Math.max(...present.map((r) => r.marksObtained)) : 0;
    const lo = present.length ? Math.min(...present.map((r) => r.marksObtained)) : 0;
    console.log(`  ${subject.name.padEnd(16)} | ${records.length} students | absent=${absentCount} | avg=${avg} | range=${lo}–${hi}`);
  }

  console.log(`\n=== Done — ${totalCreated} mark records created ===\n`);
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());