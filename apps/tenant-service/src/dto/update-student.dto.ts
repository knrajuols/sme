// Issue-219: Atomic enrollment update — enrollment data is bundled into this DTO so the
// backend performs a single atomic $transaction for student + enrollment upsert.
// Issue-222: All schema fields added; lastName made optional.
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsDate, IsEnum, IsOptional, IsString, IsUUID,
  MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { BloodGroup, Relation, Religion, StudentCategory, StudentStatus } from '../enums';
import { EnrollStudentDto } from './enroll-student.dto';

export class UpdateStudentDto {
  // ── Core Identity ────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfJoining?: Date;

  @ApiPropertyOptional({ example: 'Aarav' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Kumar' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string | null;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'Aru' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string | null;

  @ApiPropertyOptional({ example: '2016-08-10T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;

  @ApiPropertyOptional({ example: 'MALE' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @ApiPropertyOptional({ example: 'Non-binary' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredGender?: string | null;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @ApiPropertyOptional({ example: 'A_POS', enum: BloodGroup })
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @ApiPropertyOptional({ example: 'Tamil' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  motherTongue?: string;

  @ApiPropertyOptional({ example: 'Indian' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationality?: string;

  // ── Government & Compliance ─────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'GENERAL', enum: StudentCategory })
  @IsOptional()
  @IsEnum(StudentCategory)
  category?: StudentCategory;

  @ApiPropertyOptional({ example: 'HINDUISM', enum: Religion })
  @IsOptional()
  @IsEnum(Religion)
  religion?: Religion;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  caste?: string | null;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  aadhaarMasked?: string | null;

  @ApiPropertyOptional({ example: 'APAAR12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  apaarId?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isRteAdmission?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isCwsn?: boolean;

  @ApiPropertyOptional({ example: 'Visual Impairment' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  disabilityType?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isBpl?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMinority?: boolean;

  // ── Health & Emergency ──────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'Peanuts, Dust' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  allergies?: string | null;

  @ApiPropertyOptional({ example: 'Asthma' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  medicalConditions?: string | null;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  emergencyContact?: string | null;

  // ── Admission & Address ─────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'Delhi Public School' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  previousSchool?: string | null;

  @ApiPropertyOptional({ example: 'TC/2025/001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tcNumber?: string | null;

  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine?: string | null;

  @ApiPropertyOptional({ example: 'Delhi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ example: 'Delhi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string | null;

  @ApiPropertyOptional({ example: '110001' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/photo.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string | null;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfLeaving?: Date;

  @ApiPropertyOptional({ example: 'Transfer' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  leavingReason?: string | null;

  // ── Relations — Issue-225: single parent assignment with explicit per-mapping relation
  @ApiPropertyOptional({
    example: 'fa7f3bf2-b4d1-468f-8256-aeeab2f8540a',
    description: 'Set to a UUID to replace mapping; set to null to clear all mappings; omit to leave unchanged.',
    type: String,
    nullable: true,
  })
  @IsOptional()
  parentId?: string | null;

  @ApiPropertyOptional({ example: 'GUARDIAN', enum: Relation, description: 'Relation of this parent to the student for this mapping' })
  @IsOptional()
  @IsEnum(Relation)
  parentRelation?: Relation;

  @ApiPropertyOptional({
    description:
      'Optional enrollment data. When provided, atomically upserts the enrollment for the given academicYearId ' +
      '(updates existing record if already enrolled in that year, otherwise creates a new one).',
    type: EnrollStudentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollStudentDto)
  enrollment?: EnrollStudentDto;
}
