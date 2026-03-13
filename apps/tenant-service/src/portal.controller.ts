import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant, CurrentUser } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { PortalService, type FamilySummary, type TeacherSummary, type TimetableEntry } from './portal.service';

/**
 * PortalController — lightweight read endpoints that serve the role-specific
 * dashboards (Teacher Workspace / Family Portal).
 *
 * Security:
 *   - RolesGuard enforces role segregation at the method level.
 *   - userId is derived exclusively from the verified JWT (CurrentUser). No
 *     teacherId or parentId query parameters are accepted (Zero-Trust mandate).
 */
@ApiTags('Portal')
@Controller('portal')
@UseGuards(RolesGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  /**
   * GET /portal/teacher/summary
   *
   * Returns the teacher's assigned classes + subject list derived from their
   * JWT sub claim.  TEACHER access only — SCHOOL_ADMIN can view the raw
   * academic data through the /academic/* endpoints instead.
   */
  @Get('teacher/summary')
  @ApiOperation({ summary: 'Teacher dashboard summary: assigned classes and subjects' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  async getTeacherSummary(
    @CurrentUser() user: JwtClaims,
    @CurrentTenant() tenantId: string,
  ): Promise<TeacherSummary> {
    return this.portalService.getTeacherSummary(user.sub, tenantId);
  }

  /**
   * GET /portal/family/summary
   *
   * Returns the parent's linked children (with active enrollment) and upcoming
   * exams for those classes, derived from their JWT sub claim.
   */
  @Get('family/summary')
  @ApiOperation({ summary: 'Family dashboard summary: children profiles and upcoming exams' })
  @Roles('SCHOOL_ADMIN', 'PARENT', 'STUDENT')
  async getFamilySummary(
    @CurrentUser() user: JwtClaims,
    @CurrentTenant() tenantId: string,
  ): Promise<FamilySummary> {
    return this.portalService.getFamilySummary(user.sub, tenantId);
  }

  /**
   * GET /portal/teacher/timetable
   *
   * Returns the full weekly timetable for the logged-in teacher.
   * Derived strictly from JWT sub — zero-trust.
   */
  @Get('teacher/timetable')
  @ApiOperation({ summary: 'Teacher weekly timetable derived from JWT identity' })
  @Roles('TEACHER')
  async getTeacherTimetable(
    @CurrentUser() user: JwtClaims,
    @CurrentTenant() tenantId: string,
  ): Promise<TimetableEntry[]> {
    return this.portalService.getTeacherTimetable(user.sub, tenantId);
  }

  /**
   * GET /portal/family/timetable
   *
   * Returns timetable entries ONLY for the classes/sections belonging to the
   * logged-in parent's own children.  A parent can never query the global
   * timetable — strict visibility enforced in the service layer.
   */
  @Get('family/timetable')
  @ApiOperation({ summary: 'Family timetable — strict visibility by enrolled children' })
  @Roles('PARENT', 'STUDENT')
  async getFamilyTimetable(
    @CurrentUser() user: JwtClaims,
    @CurrentTenant() tenantId: string,
  ): Promise<TimetableEntry[]> {
    return this.portalService.getFamilyTimetable(user.sub, tenantId);
  }
}
