import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { Gender, Relation } from '../enums';

export class UpdateParentDto {
  @ApiPropertyOptional({ example: 'Ramesh' })
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
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'FATHER', enum: Relation })
  @IsOptional()
  @IsEnum(Relation)
  relation?: Relation | null;

  @ApiPropertyOptional({ example: 'MALE', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '+91-9876543211' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternatePhone?: string | null;

  @ApiPropertyOptional({ example: 'ramesh.sharma@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ example: 'Hindi' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  motherTongue?: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  profession?: string | null;

  // Issue-226: Full schema mapping — missing fields added
  @ApiPropertyOptional({ example: 'Hindi, English' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  knownLanguages?: string | null;

  @ApiPropertyOptional({ example: '5-10 LPA' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  annualIncomeSlab?: string | null;

  @ApiPropertyOptional({ example: 'Postgraduate' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  education?: string | null;

  @ApiPropertyOptional({ example: '1234', description: 'Last 4 digits of Aadhaar for compliance' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  aadhaarMasked?: string | null;

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

  // Issue-222: Bidirectional linking — atomically replace student mappings for this parent
  @ApiPropertyOptional({
    example: ['uuid-student-1'],
    description: 'Optional replacement set of Student IDs. When provided, atomically replaces ALL current student mappings for this parent.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  studentIds?: string[];
}
