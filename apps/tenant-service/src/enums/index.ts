/**
 * Academic domain enums — mirrors the Prisma schema enums exactly.
 * Use these for DTO validation (@IsEnum) and service logic instead of magic strings.
 * Source of truth: apps/tenant-service/prisma/schema.prisma
 */

export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TRANSFERRED = 'TRANSFERRED',
  GRADUATED = 'GRADUATED',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export enum AttendanceSessionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

/**
 * Exam workflow: DRAFT → VERIFIED → PUBLISHED
 * VERIFIED = marks entered, ready for aggregation/publish.
 * ONGOING / COMPLETED / CANCELLED are lifecycle states after publish.
 */
export enum ExamStatus {
  DRAFT = 'DRAFT',
  VERIFIED = 'VERIFIED',
  PUBLISHED = 'PUBLISHED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export enum Relation {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  GUARDIAN = 'GUARDIAN',
  GRANDPARENT = 'GRANDPARENT',
  SIBLING = 'SIBLING',
  OTHER = 'OTHER',
}

export enum BloodGroup {
  A_POS = 'A_POS',
  A_NEG = 'A_NEG',
  B_POS = 'B_POS',
  B_NEG = 'B_NEG',
  AB_POS = 'AB_POS',
  AB_NEG = 'AB_NEG',
  O_POS = 'O_POS',
  O_NEG = 'O_NEG',
  UNKNOWN = 'UNKNOWN',
}

// Issue-222: mirrors schema.prisma — required for DTO validation
export enum StudentCategory {
  GENERAL = 'GENERAL',
  OBC = 'OBC',
  SC = 'SC',
  ST = 'ST',
  EWS = 'EWS',
  PWD = 'PWD',
  CWSN = 'CWSN',
}

export enum Religion {
  HINDUISM = 'HINDUISM',
  ISLAM = 'ISLAM',
  CHRISTIANITY = 'CHRISTIANITY',
  SIKHISM = 'SIKHISM',
  BUDDHISM = 'BUDDHISM',
  JAINISM = 'JAINISM',
  OTHER = 'OTHER',
  NOT_STATED = 'NOT_STATED',
}
