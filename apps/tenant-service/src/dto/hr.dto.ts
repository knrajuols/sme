import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const SYSTEM_ROLE_CATEGORIES = ['TEACHER', 'DRIVER', 'ATTENDANT', 'STANDARD_STAFF'] as const;

// ── Department DTOs ─────────────────────────────────────────────────────────

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Science Department' })
  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'SCI', description: 'Short code used for employee ID generation' })
  @IsString() @MinLength(2) @MaxLength(20)
  code!: string;

  @ApiPropertyOptional({ example: 'Core Academics', description: 'Organizational Division grouping' })
  @IsOptional() @IsString() @MaxLength(100)
  division?: string;

  @ApiPropertyOptional({ description: 'Parent department ID for hierarchical nesting' })
  @IsOptional() @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'Science Department' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'SCI' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'Core Academics', description: 'Organizational Division grouping' })
  @IsOptional() @IsString() @MaxLength(100)
  division?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Employee Role DTOs ──────────────────────────────────────────────────────

export class CreateEmployeeRoleDto {
  @ApiProperty({ example: 'Senior Teacher' })
  @IsString() @MinLength(2) @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'SR_TCHR' })
  @IsString() @MinLength(2) @MaxLength(20)
  code!: string;

  @ApiProperty({ description: 'Parent department ID this role belongs to' })
  @IsString()
  departmentId!: string;

  @ApiPropertyOptional({ enum: SYSTEM_ROLE_CATEGORIES, example: 'STANDARD_STAFF', description: 'Drives which onboarding form the UI presents' })
  @IsOptional() @IsIn(SYSTEM_ROLE_CATEGORIES)
  systemCategory?: (typeof SYSTEM_ROLE_CATEGORIES)[number];

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmployeeRoleDto {
  @ApiPropertyOptional({ example: 'Senior Teacher' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'SR_TCHR' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ description: 'Parent department ID this role belongs to' })
  @IsOptional() @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ enum: SYSTEM_ROLE_CATEGORIES, example: 'STANDARD_STAFF', description: 'Drives which onboarding form the UI presents' })
  @IsOptional() @IsIn(SYSTEM_ROLE_CATEGORIES)
  systemCategory?: (typeof SYSTEM_ROLE_CATEGORIES)[number];

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Unified Employee DTOs ───────────────────────────────────────────────────

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Priya' })
  @IsString() @MinLength(2) @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional() @IsString() @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'priya.sharma@school.edu' })
  @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiProperty({ description: 'Department ID' })
  @IsString()
  departmentId!: string;

  @ApiProperty({ description: 'Employee Role ID' })
  @IsString()
  roleId!: string;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Date of birth (ISO 8601)' })
  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '2024-06-01', description: 'Date of joining (ISO 8601)' })
  @IsOptional() @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Priya' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional() @IsString() @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'priya.sharma@school.edu' })
  @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsOptional() @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Employee Role ID' })
  @IsOptional() @IsString()
  roleId?: string;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Date of birth (ISO 8601)' })
  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '2024-06-01', description: 'Date of joining (ISO 8601)' })
  @IsOptional() @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
