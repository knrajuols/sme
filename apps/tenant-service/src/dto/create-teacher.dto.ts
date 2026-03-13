import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  @ApiProperty({ example: 'priya.sharma@school.edu' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

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