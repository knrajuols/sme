import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { Gender, Relation } from '../enums';

export class CreateParentDto {
  @ApiProperty({ example: 'Ramesh' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  // Issue-222: lastName is culturally optional
  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  // Issue-230: Relation is optional; defaults to GUARDIAN on the backend if not provided
  @ApiPropertyOptional({ example: 'FATHER', enum: Relation })
  @IsOptional()
  @IsEnum(Relation)
  relation?: Relation;

  @ApiProperty({ example: 'MALE', enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: 'fa7f3bf2-b4d1-468f-8256-aeeab2f8540a' })
  @IsString()
  @MaxLength(50)
  userId!: string;

  // Issue-230: Phone is mandatory — primary contact channel for school communications
  @ApiProperty({ example: '+91-9876543210' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional({ example: '+91-9876543211' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternatePhone?: string;

  @ApiPropertyOptional({ example: 'ramesh.sharma@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  // Issue-230: MotherTongue is mandatory — required for language-based communication preferences
  @ApiProperty({ example: 'Hindi' })
  @IsNotEmpty({ message: 'Mother tongue is required' })
  @IsString()
  @MaxLength(50)
  motherTongue!: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  profession?: string;

  // Issue-226: Full schema mapping — missing fields added
  @ApiPropertyOptional({ example: 'Hindi, English' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  knownLanguages?: string;

  @ApiPropertyOptional({ example: '5-10 LPA' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  annualIncomeSlab?: string;

  @ApiPropertyOptional({ example: 'Postgraduate' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  education?: string;

  @ApiPropertyOptional({ example: '1234', description: 'Last 4 digits of Aadhaar for compliance' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  aadhaarMasked?: string;

  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine?: string;

  @ApiPropertyOptional({ example: 'Delhi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Delhi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: '110001' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  // Issue-222: Bidirectional linking — atomically link students on parent creation
  @ApiPropertyOptional({
    example: ['uuid-student-1'],
    description: 'Optional student IDs to atomically link to this parent on creation',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  studentIds?: string[];
}
