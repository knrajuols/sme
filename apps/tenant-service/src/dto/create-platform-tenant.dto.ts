import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// NOTE: IsNotEmpty is intentionally not used — we rely on @IsString/@IsEmail for
// mandatory fields; @IsOptional() explicitly gates non-mandatory ones.
import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class CreatePlatformTenantDto {
  // ── School Identity ──────────────────────────────────────────────────────

  @ApiProperty({ example: 'greenwood-academy', description: 'URL-safe subdomain slug (a–z, 0–9, hyphens)' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'tenantCode must be lowercase alphanumeric with hyphens only' })
  tenantCode!: string;

  @ApiProperty({ example: 'Greenwood Academy' })
  @IsString()
  @MinLength(2)
  schoolName!: string;

  @ApiPropertyOptional({
    example: '29150400615',
    description: 'UDISE code — India\'s Unified District Information System for Education (exactly 11 digits)',
  })
  @IsOptional()
  @IsString()
  @Length(11, 11, { message: 'udiseCode must be exactly 11 characters' })
  udiseCode?: string;

  // ── Address ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '42, Main Road, Koramangala' })
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'address must be at least 5 characters' })
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

  @ApiPropertyOptional({ example: '560034', description: 'Indian 6-digit PIN code (optional at registration)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit Indian PIN code' })
  pincode?: string;

  // ── Contact ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '9876543210', description: 'School contact phone (7–15 digits, optional leading +)' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{7,15}$/, { message: 'contactPhone must be a valid phone number' })
  contactPhone?: string;

  @ApiProperty({ example: 'Mary Johnson' })
  @IsString()
  @MinLength(2)
  primaryContactName!: string;

  @ApiProperty({ example: 'principal@greenwood.edu' })
  @IsEmail()
  primaryContactEmail!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @MinLength(7)
  primaryContactPhone?: string;

  // ── Optional / System ────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'pending_activation' })
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