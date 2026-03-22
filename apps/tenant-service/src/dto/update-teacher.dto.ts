import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTeacherDto {
  @ApiPropertyOptional({ example: 'Priya' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'priya.sharma@school.edu' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '1990-05-15', description: 'Date of birth (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '2024-06-01', description: 'Date of joining (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional({ example: 'EMP-1001' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  employeeCode?: string;

  @ApiPropertyOptional({ example: 'Senior Teacher' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  designation?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: ['uuid-subject-1', 'uuid-subject-2'],
    description:
      'Optional replacement set of Subject IDs. When provided, atomically replaces ALL current subject assignments for this teacher.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];
}
