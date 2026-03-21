// Issue-219: Atomic enrollment — enrollment data is bundled into this DTO so the
// backend performs a single atomic $transaction for student + enrollment creation.
// Issue-222: lastName made optional (culturally inclusive); all schema fields added.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID,
  MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { BloodGroup, Relation, Religion, StudentCategory, StudentStatus } from '../enums';
import { EnrollStudentDto } from './enroll-student.dto';

export class CreateStudentDto {
  // ── Core Identity ────────────────────────────────────────────────────────
  @ApiProperty({ example: 'ADM-2026-001' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  admissionNumber!: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfJoining?: Date;

  @ApiProperty({ example: 'Aarav' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Kumar' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  // Issue-222: lastName is culturally optional
  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Aru' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string;

  @ApiProperty({ example: '2016-08-10T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  dateOfBirth!: Date;

  @ApiProperty({ example: 'MALE' })
  @IsString()
  @MaxLength(10)
  gender!: string;

  @ApiPropertyOptional({ example: 'Non-binary' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredGender?: string;

  // Issue-230: BloodGroup is mandatory — critical for medical emergencies
  @ApiProperty({ example: 'UNKNOWN', enum: BloodGroup })
  @IsNotEmpty({ message: 'Blood group is required' })
  @IsEnum(BloodGroup)
  bloodGroup!: BloodGroup;

  // Issue-230: MotherTongue is mandatory — required for language-based instruction and reports
  @ApiProperty({ example: 'Tamil' })
  @IsNotEmpty({ message: 'Mother tongue is required' })
  @IsString()
  @MaxLength(50)
  motherTongue!: string;

  // Issue-230: Nationality is mandatory — required for PIO/NRI classification and govt records
  @ApiProperty({ example: 'Indian' })
  @IsNotEmpty({ message: 'Nationality is required' })
  @IsString()
  @MaxLength(50)
  nationality!: string;

  @ApiProperty({ example: 'ACTIVE', enum: StudentStatus })
  @IsEnum(StudentStatus)
  status!: StudentStatus;

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
  caste?: string;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  aadhaarMasked?: string;

  @ApiPropertyOptional({ example: 'APAAR12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  apaarId?: string;

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
  disabilityType?: string;

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
  allergies?: string;

  @ApiPropertyOptional({ example: 'Asthma' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  medicalConditions?: string;

  @ApiPropertyOptional({ example: 'Ravi Sharma | Father | +91-9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  emergencyContact?: string;

  // ── Admission & Address ─────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'Delhi Public School' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  previousSchool?: string;

  @ApiPropertyOptional({ example: 'TC/2025/001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tcNumber?: string;

  @ApiPropertyOptional({ example: '42, MG Road' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Karnataka' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: '560001' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/photo.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  // ── Relations — Issue-225: single parent assignment with explicit per-mapping relation
  @ApiPropertyOptional({ example: 'fa7f3bf2-b4d1-468f-8256-aeeab2f8540a', description: 'Single parent UUID to link on creation' })
  @IsOptional()
  @IsString()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: 'GUARDIAN', enum: Relation, description: 'Relation of this parent to the student for this mapping' })
  @IsOptional()
  @IsEnum(Relation)
  parentRelation?: Relation;

  @ApiPropertyOptional({
    description: 'Optional enrollment to atomically create alongside the student record.',
    type: EnrollStudentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnrollStudentDto)
  enrollment?: EnrollStudentDto;
}