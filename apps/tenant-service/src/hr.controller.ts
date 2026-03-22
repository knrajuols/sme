/**
 * hr.controller.ts — Unified HR / Employee Backbone Controller
 * ──────────────────────────────────────────────────────────────────────────────
 * REST endpoints for Department, EmployeeRole, and Employee CRUD.
 * All endpoints are tenant-scoped via @CurrentTenant().
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentTenant, CurrentUser, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { HrService } from './hr.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateEmployeeRoleDto,
  UpdateEmployeeRoleDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from './dto/hr.dto';

function buildCtx(tenantId: string, user: JwtClaims, cid?: string) {
  return {
    tenantId,
    userId: user.sub,
    role: user.roles[0] ?? 'USER',
    correlationId: cid ?? randomUUID(),
  };
}

@ApiTags('HR')
@Controller('hr')
@UseGuards(RolesGuard)
@Roles('SCHOOL_ADMIN')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  DEPARTMENTS  ═════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('departments')
  @ApiOperation({ summary: 'List all departments (with hierarchy)' })
  @Permissions('TEACHER_ASSIGN')
  async listDepartments(@CurrentTenant() tenantId: string) {
    return this.hrService.listDepartments(tenantId);
  }

  @Post('departments')
  @ApiOperation({ summary: 'Create a department' })
  @Permissions('TEACHER_ASSIGN')
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ id: string }> {
    return this.hrService.createDepartment(dto, buildCtx(tenantId, user, cid));
  }

  @Patch('departments/:id')
  @ApiOperation({ summary: 'Update a department' })
  @Permissions('TEACHER_ASSIGN')
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ updated: boolean }> {
    return this.hrService.updateDepartment(id, dto, buildCtx(tenantId, user, cid));
  }

  @Delete('departments/:id')
  @ApiOperation({ summary: 'Soft-delete a department' })
  @Permissions('TEACHER_ASSIGN')
  async deleteDepartment(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ deleted: boolean }> {
    return this.hrService.deleteDepartment(id, buildCtx(tenantId, user, cid));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  EMPLOYEE ROLES  ══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('roles')
  @ApiOperation({ summary: 'List employee roles, optionally filtered by department' })
  @Permissions('TEACHER_ASSIGN')
  async listEmployeeRoles(
    @CurrentTenant() tenantId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.hrService.listEmployeeRoles(tenantId, departmentId);
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create an employee role' })
  @Permissions('TEACHER_ASSIGN')
  async createEmployeeRole(
    @Body() dto: CreateEmployeeRoleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ id: string }> {
    return this.hrService.createEmployeeRole(dto, buildCtx(tenantId, user, cid));
  }

  @Patch('roles/:id')
  @ApiOperation({ summary: 'Update an employee role' })
  @Permissions('TEACHER_ASSIGN')
  async updateEmployeeRole(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeRoleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ updated: boolean }> {
    return this.hrService.updateEmployeeRole(id, dto, buildCtx(tenantId, user, cid));
  }

  @Delete('roles/:id')
  @ApiOperation({ summary: 'Soft-delete an employee role' })
  @Permissions('TEACHER_ASSIGN')
  async deleteEmployeeRole(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ deleted: boolean }> {
    return this.hrService.deleteEmployeeRole(id, buildCtx(tenantId, user, cid));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  EMPLOYEES  ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('employees')
  @ApiOperation({ summary: 'List all employees with department & role' })
  @Permissions('TEACHER_ASSIGN')
  async listEmployees(@CurrentTenant() tenantId: string) {
    return this.hrService.listEmployees(tenantId);
  }

  @Get('employees/:id')
  @ApiOperation({ summary: 'Get employee detail (with extension records)' })
  @Permissions('TEACHER_ASSIGN')
  async getEmployee(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.hrService.getEmployee(id, tenantId);
  }

  @Post('employees')
  @ApiOperation({ summary: 'Create a unified employee record' })
  @Permissions('TEACHER_ASSIGN')
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ id: string }> {
    return this.hrService.createEmployee(dto, buildCtx(tenantId, user, cid));
  }

  @Patch('employees/:id')
  @ApiOperation({ summary: 'Update an employee record' })
  @Permissions('TEACHER_ASSIGN')
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ updated: boolean }> {
    return this.hrService.updateEmployee(id, dto, buildCtx(tenantId, user, cid));
  }

  @Delete('employees/:id')
  @ApiOperation({ summary: 'Soft-delete an employee record' })
  @Permissions('TEACHER_ASSIGN')
  async deleteEmployee(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ deleted: boolean }> {
    return this.hrService.deleteEmployee(id, buildCtx(tenantId, user, cid));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  CLONE ORG STRUCTURE FROM MASTER  ═════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('clone-org-from-master')
  @ApiOperation({ summary: 'Clone departments & roles from MASTER_TEMPLATE into this tenant' })
  @Permissions('TEACHER_ASSIGN')
  async cloneOrgFromMaster(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ departments: number; roles: number }> {
    return this.hrService.cloneOrgFromMaster(buildCtx(tenantId, user, cid));
  }
}
