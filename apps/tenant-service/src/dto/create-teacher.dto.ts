import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ example: 'Priya' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'priya.sharma@school.edu' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: 'EMP-1001' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  employeeCode!: string;

  @ApiProperty({ example: 'Senior Teacher' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  designation!: string;

  @ApiProperty({ description: 'Department ID for the unified Employee record' })
  @IsString()
  departmentId!: string;

  @ApiProperty({ description: 'Employee Role ID for the unified Employee record' })
  @IsString()
  roleId!: string;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Date of birth (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '2024-06-01', description: 'Date of joining (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'fa7f3bf2-b4d1-468f-8256-aeeab2f8540a' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: ['uuid-subject-1', 'uuid-subject-2'],
    description: 'Optional array of Subject IDs to atomically assign to this teacher on creation',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];
}