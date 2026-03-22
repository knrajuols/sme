/**
 * staff-auth.service.ts — Staff Authentication Service
 * ──────────────────────────────────────────────────────────────────────────────
 * Handles phone+password login for employees and forced password change flow.
 * Default password is the employee's Date of Birth in DDMMYYYY format, hashed
 * with bcrypt at creation time.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { JwtTokenService } from '@sme/auth';

import { PrismaService } from './prisma/prisma.service';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class StaffAuthService {
  private readonly logger = new Logger(StaffAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  // ── Public: Hash a DOB into the default password ─────────────────────────
  /**
   * Converts a Date (or ISO string / null) into a bcrypt hash of DDMMYYYY.
   * Returns null if no DOB is provided — employee will not be able to
   * self-login until an admin sets their DOB.
   */
  async hashDateOfBirth(dob: Date | string | null | undefined): Promise<string | null> {
    if (!dob) return null;
    const d = dob instanceof Date ? dob : new Date(dob);
    if (isNaN(d.getTime())) return null;

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    const plaintext = `${dd}${mm}${yyyy}`;

    return bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
  }

  // ── Login ────────────────────────────────────────────────────────────────
  async login(phone: string, password: string, tenantCode: string): Promise<{
    accessToken: string;
    requiresPasswordChange: boolean;
    employee: { id: string; firstName: string; lastName: string | null };
  }> {
    // Step 1: Resolve tenant from subdomain code
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
      select: { id: true, name: true, status: true },
    });
    if (!tenant) {
      this.logger.warn(`[STAFF-AUTH] Login attempt with unknown tenant code: ${tenantCode}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 2: Find employee by phone within tenant
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: tenant.id,
        contactPhone: phone.trim(),
        softDelete: false,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        requiresPasswordChange: true,
        role: { select: { name: true, code: true, systemCategory: true } },
      },
    });

    if (!employee || !employee.passwordHash) {
      // Generic error — never reveal whether phone exists
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 3: Verify password hash
    const isValid = await bcrypt.compare(password, employee.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 4: Build role array from employee role
    const roles: string[] = [];
    if (employee.role.systemCategory) {
      roles.push(employee.role.systemCategory);
    }
    roles.push(employee.role.code);

    // Step 5: Issue JWT — include requiresPasswordChange and systemCategory for backend enforcement
    const sessionId = randomUUID();
    const accessToken = this.jwtTokenService.issueToken({
      sub: employee.id,
      tenantId: tenant.id,
      roles,
      sessionId,
      requiresPasswordChange: employee.requiresPasswordChange,
      systemCategory: employee.role.systemCategory ?? undefined,
    });

    // Step 6: Update lastLoginAt
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`[STAFF-AUTH] Employee ${employee.id} logged in (tenant: ${tenantCode})`);

    return {
      accessToken,
      requiresPasswordChange: employee.requiresPasswordChange,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
      },
    };
  }

  // ── Change Password ──────────────────────────────────────────────────────
  async changePassword(employeeId: string, tenantId: string, newPassword: string): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, softDelete: false },
      select: { id: true },
    });
    if (!employee) {
      throw new BadRequestException('[ERR-STAFF-AUTH-4001] Employee not found');
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        passwordHash: newHash,
        requiresPasswordChange: false,
        passwordChangedAt: new Date(),
      },
    });

    this.logger.log(`[STAFF-AUTH] Employee ${employeeId} changed password`);
  }

  // ── Backfill: Hash DOB passwords for legacy employees ────────────────────
  /**
   * [SEC-AUTH-BACKFILL] Finds all Employee records where passwordHash is null,
   * hashes their dateOfBirth as DDMMYYYY (or a safe default of 01011990),
   * and sets requiresPasswordChange = true.
   *
   * Returns a summary of how many records were processed vs skipped.
   */
  async backfillPasswords(): Promise<{
    total: number;
    updated: number;
    skipped: number;
    details: Array<{ id: string; status: string }>;
  }> {
    const DEFAULT_DOB_PLAINTEXT = '01011990';

    const employees = await this.prisma.employee.findMany({
      where: { passwordHash: null, softDelete: false },
      select: { id: true, dateOfBirth: true, firstName: true, lastName: true },
    });

    this.logger.log(`[STAFF-AUTH-BACKFILL] Found ${employees.length} employees without passwordHash`);

    const details: Array<{ id: string; status: string }> = [];
    let updated = 0;
    let skipped = 0;

    for (const emp of employees) {
      try {
        let plaintext: string;

        if (emp.dateOfBirth) {
          const d = new Date(emp.dateOfBirth);
          if (isNaN(d.getTime())) {
            plaintext = DEFAULT_DOB_PLAINTEXT;
            this.logger.warn(`[STAFF-AUTH-BACKFILL] Invalid DOB for employee ${emp.id}, using default`);
          } else {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = String(d.getFullYear());
            plaintext = `${dd}${mm}${yyyy}`;
          }
        } else {
          plaintext = DEFAULT_DOB_PLAINTEXT;
          this.logger.warn(`[STAFF-AUTH-BACKFILL] No DOB for employee ${emp.id}, using default`);
        }

        const hash = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);

        await this.prisma.employee.update({
          where: { id: emp.id },
          data: {
            passwordHash: hash,
            requiresPasswordChange: true,
          },
        });

        updated++;
        details.push({ id: emp.id, status: 'updated' });
      } catch (err) {
        skipped++;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`[STAFF-AUTH-BACKFILL] Failed to update employee ${emp.id}: ${msg}`);
        details.push({ id: emp.id, status: `error: ${msg}` });
      }
    }

    this.logger.log(`[STAFF-AUTH-BACKFILL] Complete — updated: ${updated}, skipped: ${skipped}`);

    return { total: employees.length, updated, skipped, details };
  }
}
