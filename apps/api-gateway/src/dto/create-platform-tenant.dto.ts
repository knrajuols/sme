import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class CreatePlatformTenantDto {
  @ApiProperty({ example: 'greenwood-academy' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  tenantCode!: string;

  @ApiProperty({ example: 'Greenwood Academy' })
  @IsString()
  @MinLength(2)
  schoolName!: string;

  @ApiPropertyOptional({ example: '29150400615' })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  udiseCode?: string;

  @ApiPropertyOptional({ example: '42, Main Road, Koramangala' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  address?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  city?: string;

  @ApiPropertyOptional({ example: 'Karnataka' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  state?: string;

  @ApiPropertyOptional({ example: 'Bengaluru Urban' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  district?: string;

  @ApiPropertyOptional({ example: '560034' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  pincode?: string;

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
