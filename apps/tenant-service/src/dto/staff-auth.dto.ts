/**
 * staff-auth.dto.ts — DTOs for Staff Authentication endpoints.
 * ──────────────────────────────────────────────────────────────────────────────
 * Validates login and password-change payloads.
 */
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  /** Tenant subdomain code — injected by BFF from subdomain header. */
  @IsString()
  @IsNotEmpty()
  tenantCode!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  newPassword!: string;
}
