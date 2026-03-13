import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { Gender, Relation } from '../enums';

export class CreateParentDto {
  @ApiProperty({ example: 'Ramesh' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: 'FATHER', enum: Relation })
  @IsEnum(Relation)
  relation!: Relation;

  @ApiProperty({ example: 'MALE', enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: 'fa7f3bf2-b4d1-468f-8256-aeeab2f8540a' })
  @IsString()
  @MaxLength(50)
  userId!: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

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

  @ApiPropertyOptional({ example: 'Hindi' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  motherTongue?: string;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  profession?: string;

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
}
