import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreatePlatformTenantDto {
  @ApiProperty({ example: 'greenwood-academy' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  tenantCode!: string;

  @ApiProperty({ example: 'Greenwood Academy' })
  @IsString()
  @MinLength(2)
  schoolName!: string;

  @ApiProperty({ example: 'Mary Johnson' })
  @IsString()
  @MinLength(2)
  primaryContactName!: string;

  @ApiProperty({ example: 'principal@greenwood.edu' })
  @IsEmail()
  primaryContactEmail!: string;

  @ApiProperty({ example: '+15550001111' })
  @IsString()
  @MinLength(7)
  primaryContactPhone!: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'starter' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: '6f57a8e0-4bb2-43c8-9b98-6f2de26f11d2' })
  @IsOptional()
  @IsString()
  adminUserId?: string;
}