/**
 * staff-auth.controller.ts — Staff Authentication Controller
 * ──────────────────────────────────────────────────────────────────────────────
 * Public login endpoint + protected change-password endpoint for staff members.
 * Includes a one-time backfill endpoint for legacy employee password hashing.
 */
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant, CurrentUser, Public, SkipSetupGuard } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { StaffAuthService } from './staff-auth.service';
import { StaffLoginDto, ChangePasswordDto } from './dto/staff-auth.dto';

@ApiTags('Staff Auth')
@Controller('auth/staff')
export class StaffAuthController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  /**
   * POST /auth/staff/login
   * Public endpoint — accepts phone + password + tenantCode.
   * Returns JWT + requiresPasswordChange flag.
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Staff login with phone and password' })
  async login(@Body() dto: StaffLoginDto) {
    return this.staffAuthService.login(dto.phone, dto.password, dto.tenantCode);
  }

  /**
   * POST /auth/staff/change-password
   * Protected — requires valid JWT from staff login.
   * Forces password change on first login.
   * EXEMPT from RequireSetupGuard so users can actually change their password.
   */
  @SkipSetupGuard()
  @Post('change-password')
  @ApiOperation({ summary: 'Change staff password (first-time or voluntary)' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtClaims,
    @CurrentTenant() tenantId: string,
  ) {
    await this.staffAuthService.changePassword(user.sub, tenantId, dto.newPassword);
    return { message: 'Password changed successfully' };
  }

  /**
   * POST /auth/staff/backfill-passwords
   * Protected — requires valid JWT. Intended for PLATFORM_ADMIN one-time use.
   * Hashes DOB as DDMMYYYY for all employees without a passwordHash.
   */
  @SkipSetupGuard()
  @Post('backfill-passwords')
  @ApiOperation({ summary: 'Backfill password hashes for legacy employees (one-time)' })
  async backfillPasswords() {
    return this.staffAuthService.backfillPasswords();
  }
}
