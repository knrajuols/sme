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
