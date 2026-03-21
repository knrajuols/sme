/**
 * Issue-225: Master Data Seeder — Ammulu Public School
 *
 * Standalone script to populate the "ammulu" tenant with 82 realistic students
 * and 82 parents, enrolled in Class 10 (Section A: 40, Section B: 42).
 *
 * Usage:
 *   cd apps/tenant-service
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-ammulu-students.ts
 *
 * Idempotent: skips students whose admissionNumber already exists.
 */

import { PrismaClient } from '../generated/prisma-client';
import { randomUUID } from 'crypto';

// ── Prisma client with direct DATABASE_URL ──────────────────────────────────
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:Olsbook55@localhost:5432/sme_tenant?schema=public';

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

// ── Telugu name pools (balanced Male / Female) ──────────────────────────────

const MALE_FIRST_NAMES = [
  'Arjun', 'Sai Kiran', 'Venkat', 'Ravi Teja', 'Harsha', 'Pranav',
  'Aditya', 'Karthik', 'Suresh', 'Mahesh', 'Pavan', 'Nikhil',
  'Srikanth', 'Rajesh', 'Ganesh', 'Vamsi', 'Deepak', 'Charan',
  'Varun', 'Tarun', 'Naveen', 'Manoj', 'Srinivas', 'Ramesh',
  'Bhaskar', 'Vinay', 'Rohit', 'Sandeep', 'Ajay', 'Vijay',
  'Prasad', 'Mohan', 'Kalyan', 'Ravi', 'Gopal', 'Surya',
  'Ashok', 'Hemanth', 'Dinesh', 'Kishore', 'Akhil',
];

const FEMALE_FIRST_NAMES = [
  'Lakshmi Priya', 'Ananya', 'Divya', 'Keerthi', 'Mounika', 'Swathi',
  'Priyanka', 'Sravani', 'Bhavana', 'Kavya', 'Manasa', 'Harika',
  'Deepthi', 'Sindhu', 'Lavanya', 'Sowmya', 'Meghana', 'Ramya',
  'Tejaswini', 'Sahithi', 'Pavithra', 'Anusha', 'Sushma', 'Madhavi',
  'Sirisha', 'Vaishnavi', 'Amrutha', 'Spandana', 'Chandana', 'Niharika',
  'Pooja', 'Rishitha', 'Harini', 'Tanvi', 'Varsha', 'Pallavi',
  'Pranathi', 'Gayathri', 'Supriya', 'Nandini', 'Sruthi',
];

const SURNAMES = [
  'Reddy', 'Naidu', 'Rao', 'Sharma', 'Varma', 'Chowdary', 'Raju',
  'Goud', 'Prasad', 'Kumar', 'Murthy', 'Gupta', 'Devi', 'Shetty',
  'Nair', 'Babu', 'Patel', 'Kiran', 'Chand', 'Mohan',
  'Prakash', 'Srinivas', 'Yadav', 'Singh', 'Achary',
  'Pillai', 'Chary', 'Pantulu', 'Sastry', 'Setty',
];

const PARENT_MALE_FIRST = [
  'Ramachandra', 'Venkateswara', 'Subrahmanyam', 'Narasimha', 'Srinivasa',
  'Raghunatha', 'Lakshmana', 'Jagannadha', 'Satyanarayana', 'Venkata',
  'Bala', 'Hanumanth', 'Dharma', 'Gopala', 'Shankar',
  'Rajendra', 'Muralidhar', 'Nageswara', 'Tirupathi', 'Kondal',
  'Apparao', 'Madhava', 'Bhaskara', 'Ravindra', 'Anjaneyulu',
  'Trinadha', 'Purushottam', 'Dasaradha', 'Sesha', 'Jagan',
  'Ramanuja', 'Bapiraju', 'Koteswara', 'Padmanabha', 'Siva',
  'Malla', 'Nanda', 'Parameswar', 'Veera', 'Ranga',
  'Simha', 'Kesava',
];

const PARENT_FEMALE_FIRST = [
  'Lakshmi', 'Saraswathi', 'Padmavathi', 'Sita', 'Radha',
  'Parvathi', 'Annapurna', 'Sulochana', 'Vijayalakshmi', 'Kalyani',
  'Rajyalakshmi', 'Bhagya', 'Vasantha', 'Aruna', 'Sunitha',
  'Jayalakshmi', 'Suseela', 'Hemalatha', 'Kamala', 'Savithri',
  'Rukmini', 'Nagamani', 'Varalakshmi', 'Manga', 'Durgamma',
  'Mythili', 'Tulasi', 'Chandra', 'Renuka', 'Sharada',
  'Bharathi', 'Saroja', 'Meenakshi', 'Sumathi', 'Hymavathi',
  'Nirmala', 'Indira', 'Pushpa', 'Suguna', 'Nagaratna',
  'Sujatha', 'Madhuri',
];

const BLOOD_GROUPS: Array<'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG'> = [
  'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG',
];

const CATEGORIES: Array<'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS'> = [
  'GENERAL', 'GENERAL', 'GENERAL', 'OBC', 'OBC', 'SC', 'ST', 'EWS',
];

const RELIGIONS: Array<'HINDUISM' | 'ISLAM' | 'CHRISTIANITY'> = [
  'HINDUISM', 'HINDUISM', 'HINDUISM', 'HINDUISM', 'HINDUISM',
  'HINDUISM', 'HINDUISM', 'ISLAM', 'CHRISTIANITY',
];

const CITIES = [
  'Hyderabad', 'Vijayawada', 'Visakhapatnam', 'Warangal', 'Guntur',
  'Tirupati', 'Kakinada', 'Rajahmundry', 'Nellore', 'Karimnagar',
];

// ── Deterministic random helpers ────────────────────────────────────────────

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function dateOfBirth(index: number): Date {
  // Students in Class 10 are typically 14-16 years old
  const year = 2010 + (index % 3);        // 2010, 2011, 2012
  const month = (index * 3 + 1) % 12;     // 0-11
  const day = (index % 28) + 1;           // 1-28
  return new Date(Date.UTC(year, month, day));
}

function dateOfJoining(): Date {
  // All joined April 2026 (start of academic year 2026-2027)
  return new Date(Date.UTC(2026, 3, 1));
}

function phoneNumber(index: number): string {
  // Indian mobile: 10 digits starting with 9/8/7/6
  const prefix = ['9', '8', '7', '6'][index % 4];
  const suffix = String(8480000000 + index * 1117).slice(-9);
  return prefix + suffix;
}

// ── Student generator ───────────────────────────────────────────────────────

interface StudentSeed {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: Date;
  bloodGroup: typeof BLOOD_GROUPS[number];
  category: typeof CATEGORIES[number];
  religion: typeof RELIGIONS[number];
  city: string;
  parentFirstName: string;
  parentGender: 'MALE' | 'FEMALE';
  parentRelation: 'FATHER' | 'MOTHER';
  parentPhone: string;
  sectionKey: 'A' | 'B';
  rollNumber: string;
}

function generateStudents(): StudentSeed[] {
  const students: StudentSeed[] = [];
  let maleIdx = 0;
  let femaleIdx = 0;

  for (let i = 0; i < 82; i++) {
    const sectionKey: 'A' | 'B' = i < 40 ? 'A' : 'B';
    const rollInSection = sectionKey === 'A' ? i + 1 : i - 40 + 1;
    const isMale = i % 2 === 0;

    const firstName = isMale
      ? pick(MALE_FIRST_NAMES, maleIdx++)
      : pick(FEMALE_FIRST_NAMES, femaleIdx++);
    const surname = pick(SURNAMES, i);

    // Parent: alternate father/mother
    const isParentMale = i % 3 !== 2; // ~2/3 fathers, ~1/3 mothers
    const parentFirstName = isParentMale
      ? pick(PARENT_MALE_FIRST, i)
      : pick(PARENT_FEMALE_FIRST, i);

    students.push({
      admissionNumber: `APS-2026-${String(i + 1).padStart(3, '0')}`,
      firstName,
      lastName: surname,
      gender: isMale ? 'MALE' : 'FEMALE',
      dateOfBirth: dateOfBirth(i),
      bloodGroup: pick(BLOOD_GROUPS, i),
      category: pick(CATEGORIES, i),
      religion: pick(RELIGIONS, i),
      city: pick(CITIES, i),
      parentFirstName,
      parentGender: isParentMale ? 'MALE' : 'FEMALE',
      parentRelation: isParentMale ? 'FATHER' : 'MOTHER',
      parentPhone: phoneNumber(i),
      sectionKey,
      rollNumber: String(rollInSection),
    });
  }

  return students;
}

// ── Main seeder ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Issue-225: Ammulu Public School — Student Seeder ===\n');

  // ── Step 1: Resource Discovery ──────────────────────────────────────────
  const tenant = await prisma.tenant.findFirst({
    where: { code: 'ammulu', softDelete: false },
    select: { id: true, name: true },
  });
  if (!tenant) {
    throw new Error('Tenant "ammulu" not found. Ensure the school is registered.');
  }
  const tenantId = tenant.id;
  console.log(`Tenant: ${tenant.name} (${tenantId})`);

  // Active academic year
  const activeYear = await prisma.academicYear.findFirst({
    where: { tenantId, isActive: true, softDelete: false },
    select: { id: true, name: true },
  });
  if (!activeYear) {
    throw new Error('No active Academic Year found. Seed academic years first.');
  }
  console.log(`Academic Year: ${activeYear.name} (${activeYear.id})`);

  // Class 10
  const class10 = await prisma.class.findFirst({
    where: { tenantId, name: 'Class 10', academicYearId: activeYear.id, softDelete: false },
    select: { id: true, name: true },
  });
  if (!class10) {
    throw new Error('Class 10 not found for the active academic year. Seed classes first.');
  }
  console.log(`Class: ${class10.name} (${class10.id})`);

  // Sections via ClassSection join table
  const classSections = await prisma.classSection.findMany({
    where: { tenantId, classId: class10.id, softDelete: false },
    select: { id: true, sectionId: true, name: true, section: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  const sectionMap: Record<string, string> = {};
  for (const cs of classSections) {
    const sectionName = cs.section.name;
    // Match "Section A" or just "A"
    if (sectionName === 'Section A' || sectionName === 'A') {
      sectionMap['A'] = cs.sectionId;
    } else if (sectionName === 'Section B' || sectionName === 'B') {
      sectionMap['B'] = cs.sectionId;
    }
  }
  if (!sectionMap['A'] || !sectionMap['B']) {
    throw new Error(
      `Class 10 must have ClassSection assignments for Section A and Section B. ` +
      `Found: ${classSections.map((cs) => `${cs.section.name} (${cs.sectionId})`).join(', ')}`,
    );
  }
  console.log(`Section A sectionId: ${sectionMap['A']}`);
  console.log(`Section B sectionId: ${sectionMap['B']}`);

  // ── Step 2: Generate Data ───────────────────────────────────────────────
  const seeds = generateStudents();
  console.log(`\nGenerated ${seeds.length} student records. Starting insert...\n`);

  // ── Step 3: Upsert in a Transaction ─────────────────────────────────────
  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const seed of seeds) {
      // Idempotency: skip if admissionNumber already exists
      const existing = await tx.student.findFirst({
        where: { tenantId, admissionNumber: seed.admissionNumber, softDelete: false },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Create Parent
      const parentId = randomUUID();
      const parentUserId = randomUUID(); // Placeholder userId (no IAM user created)
      await tx.parent.create({
        data: {
          id: parentId,
          tenantId,
          userId: parentUserId,
          firstName: seed.parentFirstName,
          lastName: seed.lastName,
          relation: seed.parentRelation,
          gender: seed.parentGender,
          phone: seed.parentPhone,
          motherTongue: 'Telugu',
          city: seed.city,
          state: 'Telangana',
          pincode: '500001',
        },
      });

      // Create Student
      const studentId = randomUUID();
      await tx.student.create({
        data: {
          id: studentId,
          tenantId,
          admissionNumber: seed.admissionNumber,
          dateOfJoining: dateOfJoining(),
          firstName: seed.firstName,
          lastName: seed.lastName,
          dateOfBirth: seed.dateOfBirth,
          gender: seed.gender,
          bloodGroup: seed.bloodGroup,
          motherTongue: 'Telugu',
          nationality: 'Indian',
          category: seed.category,
          religion: seed.religion,
          city: seed.city,
          state: 'Telangana',
          pincode: '500001',
          status: 'ACTIVE',
        },
      });

      // Create Parent-Student Mapping
      await tx.parentStudentMapping.create({
        data: {
          id: randomUUID(),
          tenantId,
          parentId,
          studentId,
          relation: seed.parentRelation,
        },
      });

      // Create Student Enrollment
      const sectionId = sectionMap[seed.sectionKey];
      await tx.studentEnrollment.create({
        data: {
          id: randomUUID(),
          tenantId,
          studentId,
          classId: class10.id,
          sectionId,
          academicYearId: activeYear.id,
          rollNumber: seed.rollNumber,
        },
      });

      created++;
    }
  });

  // ── Step 4: Summary Report ──────────────────────────────────────────────
  console.log('─'.repeat(50));
  console.log(`✔ ${created} Students Created`);
  console.log(`✔ ${created} Parents Created`);
  console.log(`✔ ${created} Parent-Student Mappings Created`);
  console.log(`✔ ${created} Student Enrollments Created`);
  if (skipped > 0) {
    console.log(`⏭ ${skipped} Students Skipped (already exist)`);
  }
  console.log('─'.repeat(50));

  // Verify counts
  const sectionACnt = await prisma.studentEnrollment.count({
    where: { tenantId, classId: class10.id, sectionId: sectionMap['A'], academicYearId: activeYear.id, softDelete: false },
  });
  const sectionBCnt = await prisma.studentEnrollment.count({
    where: { tenantId, classId: class10.id, sectionId: sectionMap['B'], academicYearId: activeYear.id, softDelete: false },
  });
  console.log(`\nVerification:`);
  console.log(`  Section A enrollments: ${sectionACnt}`);
  console.log(`  Section B enrollments: ${sectionBCnt}`);
  console.log(`  Total: ${sectionACnt + sectionBCnt}`);
}

main()
  .catch((err) => {
    console.error('\n✘ Seeder failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
