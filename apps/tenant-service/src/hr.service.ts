/**
 * hr.service.ts — Unified HR / Employee Backbone Service
 * ──────────────────────────────────────────────────────────────────────────────
 * CRUD for Department, EmployeeRole, and Employee entities.
 * All operations are strictly tenant-scoped.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from './prisma/prisma.service';
import { StaffAuthService } from './staff-auth.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateEmployeeRoleDto,
  UpdateEmployeeRoleDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from './dto/hr.dto';

interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  correlationId: string;
}

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  DEPARTMENTS  ═════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listDepartments(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId, softDelete: false },
      include: {
        parent: { select: { id: true, name: true, code: true, division: true } },
        children: {
          where: { softDelete: false },
          select: { id: true, name: true, code: true, isActive: true, division: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(dto: CreateDepartmentDto, ctx: RequestContext): Promise<{ id: string }> {
    // Validate parent exists if provided
    if (dto.parentId) {
      const parent = await this.prisma.department.findFirst({
        where: { id: dto.parentId, tenantId: ctx.tenantId, softDelete: false },
      });
      if (!parent) throw new BadRequestException('[ERR-HR-4001] Parent department not found');
    }

    const id = randomUUID();
    await this.prisma.department.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        name: dto.name,
        code: dto.code,
        division: dto.division ?? null,
        parentId: dto.parentId ?? null,
        isActive: dto.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    return { id };
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.department.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('[ERR-HR-4041] Department not found');

    if (dto.parentId) {
      // Prevent circular reference — cannot be own parent
      if (dto.parentId === id) throw new BadRequestException('[ERR-HR-4002] Department cannot be its own parent');
      const parent = await this.prisma.department.findFirst({
        where: { id: dto.parentId, tenantId: ctx.tenantId, softDelete: false },
      });
      if (!parent) throw new BadRequestException('[ERR-HR-4001] Parent department not found');
    }

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.division !== undefined) data.division = dto.division;
    if (dto.parentId !== undefined) data.parentId = dto.parentId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.department.update({ where: { id }, data });
    return { updated: true };
  }

  async deleteDepartment(id: string, ctx: RequestContext): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.department.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('[ERR-HR-4041] Department not found');
    await this.prisma.department.update({
      where: { id },
      data: { softDelete: true, updatedBy: ctx.userId },
    });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  EMPLOYEE ROLES  ══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listEmployeeRoles(tenantId: string, departmentId?: string) {
    return this.prisma.employeeRole.findMany({
      where: {
        tenantId,
        softDelete: false,
        ...(departmentId ? { departmentId } : {}),
      },
      include: {
        department: { select: { id: true, name: true, code: true, division: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createEmployeeRole(dto: CreateEmployeeRoleDto, ctx: RequestContext): Promise<{ id: string }> {
    // Validate department exists
    const dept = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!dept) throw new BadRequestException('[ERR-HR-4005] Department not found for role');

    const id = randomUUID();
    await this.prisma.employeeRole.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        name: dto.name,
        code: dto.code,
        departmentId: dto.departmentId,
        systemCategory: (dto.systemCategory as any) ?? 'STANDARD_STAFF',
        isActive: dto.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    return { id };
  }

  async updateEmployeeRole(id: string, dto: UpdateEmployeeRoleDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.employeeRole.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('[ERR-HR-4042] Employee role not found');

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId: ctx.tenantId, softDelete: false },
      });
      if (!dept) throw new BadRequestException('[ERR-HR-4005] Department not found for role');
    }

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.systemCategory !== undefined) data.systemCategory = dto.systemCategory;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.employeeRole.update({ where: { id }, data });
    return { updated: true };
  }

  async deleteEmployeeRole(id: string, ctx: RequestContext): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.employeeRole.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('[ERR-HR-4042] Employee role not found');
    await this.prisma.employeeRole.update({
      where: { id },
      data: { softDelete: true, updatedBy: ctx.userId },
    });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  EMPLOYEES  ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  async listEmployees(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId, softDelete: false },
      include: {
        department: { select: { id: true, name: true, code: true } },
        role: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getEmployee(id: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, softDelete: false },
      include: {
        department: { select: { id: true, name: true, code: true } },
        role: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, employeeCode: true, designation: true } },
        driver: { select: { id: true, licenseNumber: true } },
        attendant: { select: { id: true } },
      },
    });
    if (!employee) throw new NotFoundException('[ERR-HR-4043] Employee not found');
    return employee;
  }

  async createEmployee(dto: CreateEmployeeDto, ctx: RequestContext): Promise<{ id: string }> {
    // Validate department
    const dept = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!dept) throw new BadRequestException('[ERR-HR-4003] Department not found');

    // Validate role
    const role = await this.prisma.employeeRole.findFirst({
      where: { id: dto.roleId, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!role) throw new BadRequestException('[ERR-HR-4004] Employee role not found');

    const id = randomUUID();

    // Hash DOB as default password (DDMMYYYY format)
    const passwordHash = await this.staffAuth.hashDateOfBirth(
      dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
    );

    await this.prisma.employee.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        contactPhone: dto.contactPhone ?? null,
        email: dto.email ?? null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
        passwordHash,
        requiresPasswordChange: true,
        departmentId: dto.departmentId,
        roleId: dto.roleId,
        isActive: dto.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    return { id };
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, ctx: RequestContext): Promise<{ updated: boolean }> {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('[ERR-HR-4043] Employee not found');

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId: ctx.tenantId, softDelete: false },
      });
      if (!dept) throw new BadRequestException('[ERR-HR-4003] Department not found');
    }
    if (dto.roleId) {
      const role = await this.prisma.employeeRole.findFirst({
        where: { id: dto.roleId, tenantId: ctx.tenantId, softDelete: false },
      });
      if (!role) throw new BadRequestException('[ERR-HR-4004] Employee role not found');
    }

    const data: Record<string, unknown> = { updatedBy: ctx.userId };
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    if (dto.dateOfJoining !== undefined) data.dateOfJoining = dto.dateOfJoining ? new Date(dto.dateOfJoining) : null;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.roleId !== undefined) data.roleId = dto.roleId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.employee.update({ where: { id }, data });
    return { updated: true };
  }

  async deleteEmployee(id: string, ctx: RequestContext): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId, softDelete: false },
    });
    if (!existing) throw new NotFoundException('[ERR-HR-4043] Employee not found');
    await this.prisma.employee.update({
      where: { id },
      data: { softDelete: true, updatedBy: ctx.userId },
    });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  SEED ORG STRUCTURE (MASTER_TEMPLATE)  ════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Seed the canonical org structure into a tenant (normally MASTER_TEMPLATE).
   * Creates parent groupings, child departments, and employee roles.
   * Idempotent — skips records whose code already exists for the tenant.
   */
  async seedOrgStructure(ctx: RequestContext): Promise<{ departments: number; roles: number }> {
    // ── Seed data derived from "Dept Groups v2.csv" ─────────────────────────
    const ORG_SEED: {
      grouping: { name: string; code: string };
      departments: {
        name: string;
        code: string;
        roles: { name: string; code: string; systemCategory: string }[];
      }[];
    }[] = [
      {
        grouping: { name: 'Core Academics', code: 'CORE_ACAD' },
        departments: [
          {
            name: 'Academics', code: 'ACAD',
            roles: [
              { name: 'Teacher',            code: 'TEACHER',         systemCategory: 'ACADEMIC_STAFF' },
              { name: 'Subject HOD',        code: 'SUBJECT_HOD',    systemCategory: 'ACADEMIC_HOD' },
              { name: 'Coordinator',        code: 'COORDINATOR',    systemCategory: 'ACADEMIC_COORDINATOR' },
            ],
          },
          {
            name: 'Examinations', code: 'EXAMS',
            roles: [
              { name: 'Exam Coordinator',   code: 'EXAM_COORD',     systemCategory: 'EXAM_COORDINATOR' },
              { name: 'Invigilator',        code: 'INVIGILATOR',    systemCategory: 'EXAM_INVIGILATOR' },
            ],
          },
          {
            name: 'Digital Learning / eLearning', code: 'DIGITAL_LEARN',
            roles: [
              { name: 'Content Creator',    code: 'CONTENT_CREATOR', systemCategory: 'DIGITAL_CONTENT_CREATOR' },
              { name: 'LMS Admin',          code: 'LMS_ADMIN',      systemCategory: 'LMS_ADMIN' },
            ],
          },
          {
            name: 'Academic Research', code: 'ACAD_RESEARCH',
            roles: [
              { name: 'Curriculum Designer', code: 'CURRICULUM_DES', systemCategory: 'CURRICULUM_DESIGNER' },
            ],
          },
        ],
      },
      {
        grouping: { name: 'Administration', code: 'ADMIN' },
        departments: [
          {
            name: 'Management & Executive', code: 'MGMT_EXEC',
            roles: [
              { name: 'Principal',          code: 'PRINCIPAL',       systemCategory: 'PRINCIPAL' },
              { name: 'Director',           code: 'DIRECTOR',        systemCategory: 'DIRECTOR' },
              { name: 'Board Member',       code: 'BOARD_MEMBER',    systemCategory: 'BOARD_MEMBER' },
            ],
          },
          {
            name: 'Admissions & Front Office', code: 'ADMISSIONS',
            roles: [
              { name: 'Receptionist',       code: 'RECEPTIONIST',    systemCategory: 'RECEPTIONIST' },
              { name: 'Admissions Counselor', code: 'ADMISSIONS_COUN', systemCategory: 'ADMISSIONS_COUNSELOR' },
            ],
          },
          {
            name: 'IT / Administration', code: 'IT_ADMIN',
            roles: [
              { name: 'System Admin',       code: 'SYS_ADMIN',      systemCategory: 'SYS_ADMIN' },
              { name: 'Data Entry Operator', code: 'DATA_ENTRY',     systemCategory: 'DATA_ENTRY_STAFF' },
            ],
          },
        ],
      },
      {
        grouping: { name: 'Ops & Finance', code: 'OPS_FINANCE' },
        departments: [
          {
            name: 'Finance & Accounts', code: 'FINANCE',
            roles: [
              { name: 'Accountant',         code: 'ACCOUNTANT',      systemCategory: 'FINANCE_ACCOUNTANT' },
              { name: 'Fee Collector',      code: 'FEE_COLLECTOR',   systemCategory: 'FEE_COLLECTOR' },
            ],
          },
          {
            name: 'Human Resources', code: 'HR',
            roles: [
              { name: 'HR Manager',         code: 'HR_MANAGER',      systemCategory: 'HR_MANAGER' },
              { name: 'Recruiter',          code: 'RECRUITER',       systemCategory: 'HR_RECRUITER' },
            ],
          },
          {
            name: 'Legal & Compliance', code: 'LEGAL',
            roles: [
              { name: 'Compliance Officer', code: 'COMPLIANCE_OFF',  systemCategory: 'LEGAL_STAFF' },
            ],
          },
          {
            name: 'Procurement & Stores', code: 'PROCUREMENT',
            roles: [
              { name: 'Store Manager',      code: 'STORE_MGR',       systemCategory: 'STORE_MANAGER' },
              { name: 'Purchase Officer',   code: 'PURCHASE_OFF',    systemCategory: 'PURCHASE_OFFICER' },
            ],
          },
        ],
      },
      {
        grouping: { name: 'Growth & Outreach', code: 'GROWTH' },
        departments: [
          {
            name: 'Marketing & Branding', code: 'MARKETING',
            roles: [
              { name: 'Marketing Manager',  code: 'MKTG_MANAGER',   systemCategory: 'MARKETING_STAFF' },
              { name: 'SEO Specialist',     code: 'SEO_SPECIALIST',  systemCategory: 'MARKETING_STAFF' },
            ],
          },
          {
            name: 'Communications & Alumni', code: 'COMMUNICATIONS',
            roles: [
              { name: 'PR Officer',         code: 'PR_OFFICER',      systemCategory: 'COMMUNICATION_STAFF' },
              { name: 'Event Coordinator',  code: 'EVENT_COORD',     systemCategory: 'EVENT_COORDINATOR' },
            ],
          },
        ],
      },
      {
        grouping: { name: 'Campus Services', code: 'CAMPUS_SVC' },
        departments: [
          {
            name: 'Transport', code: 'TRANSPORT',
            roles: [
              { name: 'Bus Driver',         code: 'BUS_DRIVER',      systemCategory: 'DRIVER' },
              { name: 'Fleet Manager',      code: 'FLEET_MGR',       systemCategory: 'FLEET_MANAGER' },
              { name: 'Attendant',          code: 'ATTENDANT',       systemCategory: 'ATTENDANT' },
            ],
          },
          {
            name: 'Facilities & Maintenance', code: 'FACILITIES',
            roles: [
              { name: 'Estate Manager',     code: 'ESTATE_MGR',      systemCategory: 'ESTATE_MANAGER' },
              { name: 'Electrician',        code: 'ELECTRICIAN',     systemCategory: 'MAINTENANCE_STAFF' },
              { name: 'Janitor',            code: 'JANITOR',         systemCategory: 'JANITORIAL_STAFF' },
            ],
          },
          {
            name: 'Security', code: 'SECURITY',
            roles: [
              { name: 'Chief Security Officer', code: 'CHIEF_SEC_OFF', systemCategory: 'SECURITY_OFFICER' },
              { name: 'Gate Guard',         code: 'GATE_GUARD',      systemCategory: 'SECURITY_GUARD' },
            ],
          },
          {
            name: 'Cafeteria / Mess', code: 'CAFETERIA',
            roles: [
              { name: 'Catering Manager',   code: 'CATERING_MGR',    systemCategory: 'CATERING_MANAGER' },
              { name: 'Chef',               code: 'CHEF',            systemCategory: 'CAFETERIA_STAFF' },
            ],
          },
        ],
      },
      {
        grouping: { name: 'Student Life', code: 'STUDENT_LIFE' },
        departments: [
          {
            name: 'Medical & Wellness', code: 'MEDICAL',
            roles: [
              { name: 'School Nurse',       code: 'SCHOOL_NURSE',    systemCategory: 'SCHOOL_NURSE' },
              { name: 'Psychologist',       code: 'PSYCHOLOGIST',    systemCategory: 'SCHOOL_PSYCHOLOGIST' },
            ],
          },
          {
            name: 'Library', code: 'LIBRARY',
            roles: [
              { name: 'Librarian',          code: 'LIBRARIAN',       systemCategory: 'LIBRARIAN' },
              { name: 'Assistant Librarian', code: 'ASST_LIBRARIAN', systemCategory: 'ASSISTANT_LIBRARIAN' },
            ],
          },
          {
            name: 'Sports & Physical Education', code: 'SPORTS',
            roles: [
              { name: 'Coach',              code: 'COACH',           systemCategory: 'SPORTS_COACH' },
              { name: 'PE Instructor',      code: 'PE_INSTRUCTOR',   systemCategory: 'PE_INSTRUCTOR' },
            ],
          },
          {
            name: 'Hostel & Boarding', code: 'HOSTEL',
            roles: [
              { name: 'Warden',             code: 'WARDEN',          systemCategory: 'HOSTEL_WARDEN' },
              { name: 'Dorm Supervisor',    code: 'DORM_SUPERVISOR', systemCategory: 'DORM_SUPERVISOR' },
            ],
          },
        ],
      },
    ];

    let deptsCreated = 0;
    let rolesCreated = 0;

    await this.prisma.$transaction(async (tx) => {
      // Fetch already-existing department & role codes for this tenant
      const existingDeptCodes = new Set(
        (await tx.department.findMany({
          where: { tenantId: ctx.tenantId, softDelete: false },
          select: { code: true },
        })).map((d) => d.code),
      );
      const existingRoleCodes = new Set(
        (await tx.employeeRole.findMany({
          where: { tenantId: ctx.tenantId, softDelete: false },
          select: { code: true },
        })).map((r) => r.code),
      );

      for (const group of ORG_SEED) {
        // Upsert the parent grouping department
        const divisionName = group.grouping.name;
        let parentId: string;
        if (existingDeptCodes.has(group.grouping.code)) {
          const existing = await tx.department.findFirst({
            where: { tenantId: ctx.tenantId, code: group.grouping.code, softDelete: false },
          });
          parentId = existing!.id;
          // Backfill division on existing parent if missing
          if (!existing!.division) {
            await tx.department.update({ where: { id: parentId }, data: { division: divisionName } });
          }
        } else {
          parentId = randomUUID();
          await tx.department.create({
            data: {
              id: parentId,
              tenantId: ctx.tenantId,
              name: group.grouping.name,
              code: group.grouping.code,
              division: divisionName,
              parentId: null,
              isActive: true,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
          });
          existingDeptCodes.add(group.grouping.code);
          deptsCreated++;
        }

        for (const dept of group.departments) {
          // Upsert the child department — forward-fill division from grouping
          let deptId: string;
          if (existingDeptCodes.has(dept.code)) {
            const existing = await tx.department.findFirst({
              where: { tenantId: ctx.tenantId, code: dept.code, softDelete: false },
            });
            deptId = existing!.id;
            // Backfill division on existing child if missing
            if (!existing!.division) {
              await tx.department.update({ where: { id: deptId }, data: { division: divisionName } });
            }
          } else {
            deptId = randomUUID();
            await tx.department.create({
              data: {
                id: deptId,
                tenantId: ctx.tenantId,
                name: dept.name,
                code: dept.code,
                division: divisionName,
                parentId,
                isActive: true,
                createdBy: ctx.userId,
                updatedBy: ctx.userId,
              },
            });
            existingDeptCodes.add(dept.code);
            deptsCreated++;
          }

          // Upsert roles under this department
          for (const role of dept.roles) {
            if (existingRoleCodes.has(role.code)) continue;
            await tx.employeeRole.create({
              data: {
                id: randomUUID(),
                tenantId: ctx.tenantId,
                name: role.name,
                code: role.code,
                departmentId: deptId,
                systemCategory: role.systemCategory as any,
                isActive: true,
                createdBy: ctx.userId,
                updatedBy: ctx.userId,
              },
            });
            existingRoleCodes.add(role.code);
            rolesCreated++;
          }
        }
      }
    });

    this.logger.log(
      `Seeded org structure for ${ctx.tenantId}: ${deptsCreated} departments, ${rolesCreated} roles`,
    );
    return { departments: deptsCreated, roles: rolesCreated };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══  CLONE ORG FROM MASTER_TEMPLATE  ══════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clones Departments and EmployeeRoles from MASTER_TEMPLATE into the
   * caller's tenant. Preserves hierarchy. Idempotent — skips codes that
   * already exist in the target tenant.
   */
  async cloneOrgFromMaster(
    ctx: RequestContext,
  ): Promise<{ departments: number; roles: number }> {
    const MASTER = 'MASTER_TEMPLATE';
    if (ctx.tenantId === MASTER) {
      throw new BadRequestException('Cannot clone master data into MASTER_TEMPLATE itself');
    }

    // Fetch all master departments (flat list) and roles
    const [masterDepts, masterRoles] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId: MASTER, softDelete: false },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.employeeRole.findMany({
        where: { tenantId: MASTER, softDelete: false },
      }),
    ]);

    if (masterDepts.length === 0) {
      throw new NotFoundException('No org-structure data found in MASTER_TEMPLATE. Seed master data first.');
    }

    let deptsCloned = 0;
    let rolesCloned = 0;

    await this.prisma.$transaction(async (tx) => {
      // Existing codes in target tenant
      const existingDeptCodes = new Set(
        (await tx.department.findMany({
          where: { tenantId: ctx.tenantId, softDelete: false },
          select: { code: true },
        })).map((d) => d.code),
      );
      const existingRoleCodes = new Set(
        (await tx.employeeRole.findMany({
          where: { tenantId: ctx.tenantId, softDelete: false },
          select: { code: true },
        })).map((r) => r.code),
      );

      // Build a masterDeptId → newDeptId map (needed for parentId + role.departmentId)
      const deptIdMap = new Map<string, string>();

      // Process root departments first (parentId === null), then children
      const roots = masterDepts.filter((d) => !d.parentId);
      const children = masterDepts.filter((d) => d.parentId);

      for (const md of roots) {
        if (existingDeptCodes.has(md.code)) {
          const local = await tx.department.findFirst({
            where: { tenantId: ctx.tenantId, code: md.code, softDelete: false },
          });
          if (local) deptIdMap.set(md.id, local.id);
          continue;
        }
        const newId = randomUUID();
        await tx.department.create({
          data: {
            id: newId,
            tenantId: ctx.tenantId,
            name: md.name,
            code: md.code,
            division: md.division ?? null,
            parentId: null,
            isActive: true,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        });
        deptIdMap.set(md.id, newId);
        existingDeptCodes.add(md.code);
        deptsCloned++;
      }

      for (const md of children) {
        if (existingDeptCodes.has(md.code)) {
          const local = await tx.department.findFirst({
            where: { tenantId: ctx.tenantId, code: md.code, softDelete: false },
          });
          if (local) deptIdMap.set(md.id, local.id);
          continue;
        }
        const newParentId = md.parentId ? deptIdMap.get(md.parentId) ?? null : null;
        const newId = randomUUID();
        await tx.department.create({
          data: {
            id: newId,
            tenantId: ctx.tenantId,
            name: md.name,
            code: md.code,
            division: md.division ?? null,
            parentId: newParentId,
            isActive: true,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        });
        deptIdMap.set(md.id, newId);
        existingDeptCodes.add(md.code);
        deptsCloned++;
      }

      // Clone roles
      for (const mr of masterRoles) {
        if (existingRoleCodes.has(mr.code)) continue;
        const newDeptId = deptIdMap.get(mr.departmentId);
        if (!newDeptId) {
          this.logger.warn(
            `Skipping role "${mr.name}" (${mr.code}): target department not found`,
          );
          continue;
        }
        await tx.employeeRole.create({
          data: {
            id: randomUUID(),
            tenantId: ctx.tenantId,
            name: mr.name,
            code: mr.code,
            departmentId: newDeptId,
            systemCategory: mr.systemCategory,
            isActive: true,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        });
        existingRoleCodes.add(mr.code);
        rolesCloned++;
      }
    });

    this.logger.log(
      `Cloned org structure from MASTER_TEMPLATE → ${ctx.tenantId}: ${deptsCloned} departments, ${rolesCloned} roles`,
    );
    return { departments: deptsCloned, roles: rolesCloned };
  }
}
