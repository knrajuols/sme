import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, MinLength } from 'class-validator';

import { SchoolStatus } from '../generated/prisma-client';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Greenwood Academy' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  schoolName?: string;

  @ApiPropertyOptional({ example: 'Greenwood Academy Pvt. Ltd.' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({
    example: '29150400615',
    description: 'UDISE code — exactly 11 digits',
  })
  @IsOptional()
  @IsString()
  @Length(11, 11, { message: 'udiseCode must be exactly 11 characters' })
  udiseCode?: string;

  @ApiPropertyOptional({ example: 'CBSE/OTH/12345/678' })
  @IsOptional()
  @IsString()
  affiliationNumber?: string;

  @ApiPropertyOptional({ example: 'CBSE' })
  @IsOptional()
  @IsString()
  board?: string;

  @ApiPropertyOptional({ example: '42, Main Road, Koramangala' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Karnataka' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '560034' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ example: 'Bengaluru Urban' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'admin@greenwood.edu.in' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'https://greenwoodacademy.edu.in' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 1998 })
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(new Date().getFullYear())
  establishmentYear?: number;

  @ApiPropertyOptional({ example: 'Private Unaided' })
  @IsOptional()
  @IsString()
  schoolType?: string;

  @ApiPropertyOptional({ example: 'Private' })
  @IsOptional()
  @IsString()
  managementType?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  lowestClass?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  highestClass?: string;

  @ApiPropertyOptional({ enum: SchoolStatus })
  @IsOptional()
  @IsEnum(SchoolStatus)
  schoolStatus?: SchoolStatus;
}
