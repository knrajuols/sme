import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { StudentStatus } from '../enums';

export class CreateStudentDto {
  @ApiProperty({ example: 'ADM-2026-001' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  admissionNumber!: string;

  @ApiProperty({ example: 'Aarav' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: '2016-08-10T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  dateOfBirth!: Date;

  @ApiProperty({ example: 'MALE' })
  @IsString()
  @MaxLength(10)
  gender!: string;

  @ApiProperty({ example: 'ACTIVE', enum: StudentStatus })
  @IsEnum(StudentStatus)
  status!: StudentStatus;

  @ApiPropertyOptional({
    example: ['uuid-parent-1'],
    description: 'Optional parent IDs to atomically link to this student on creation',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  parentIds?: string[];
}