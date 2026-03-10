import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import {
  CurrentTenant,
  CurrentUser,
  Permissions,
} from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AcademicService } from './academic.service';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateStudentEnrollmentDto } from './dto/create-student-enrollment.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@ApiTags('Academic')
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  // ── Academic Years ──────────────────────────────────────────────────────────

  @Get('years')
  @ApiOperation({ summary: 'List academic years for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async listAcademicYears(
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{ id: string; name: string; startDate: Date; endDate: Date; isActive: boolean; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listAcademicYears(tenantId);
  }

  @Post('years')
  @ApiOperation({ summary: 'Create academic year' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async createAcademicYear(
    @Body() dto: CreateAcademicYearDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createAcademicYear(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('years/:id')
  @ApiOperation({ summary: 'Update academic year' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async updateAcademicYear(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateAcademicYear(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('years/:id')
  @ApiOperation({ summary: 'Soft-delete academic year' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async deleteAcademicYear(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteAcademicYear(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Classes ────────────────────────────────────────────────────────────────

  @Get('classes')
  @ApiOperation({ summary: 'List classes for tenant (optionally filtered by academicYearId)' })
  @Permissions('CLASS_CREATE')
  async listClasses(
    @CurrentTenant() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<Array<{ id: string; name: string; code: string; academicYearId: string; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listClasses(tenantId, academicYearId);
  }

  @Post('classes')
  @ApiOperation({ summary: 'Create class' })
  @Permissions('CLASS_CREATE')
  async createClass(
    @Body() dto: CreateClassDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createClass(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('classes/:id')
  @ApiOperation({ summary: 'Update class' })
  @Permissions('CLASS_CREATE')
  async updateClass(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateClass(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('classes/:id')
  @ApiOperation({ summary: 'Soft-delete class' })
  @Permissions('CLASS_CREATE')
  async deleteClass(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteClass(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  @Get('sections')
  @ApiOperation({ summary: 'List sections for tenant (optionally filtered by classId)' })
  @Permissions('SECTION_CREATE')
  async listSections(
    @CurrentTenant() tenantId: string,
    @Query('classId') classId?: string,
  ): Promise<Array<{ id: string; name: string; classId: string; className: string; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listSections(tenantId, classId);
  }

  @Post('sections')
  @ApiOperation({ summary: 'Create section' })
  @Permissions('SECTION_CREATE')
  async createSection(
    @Body() dto: CreateSectionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createSection(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('sections/:id')
  @ApiOperation({ summary: 'Update section' })
  @Permissions('SECTION_CREATE')
  async updateSection(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateSection(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('sections/:id')
  @ApiOperation({ summary: 'Soft-delete section' })
  @Permissions('SECTION_CREATE')
  async deleteSection(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteSection(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Subjects ───────────────────────────────────────────────────────────────

  @Get('subjects')
  @ApiOperation({ summary: 'List subjects for tenant' })
  @Permissions('SUBJECT_CREATE')
  async listSubjects(
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{ id: string; name: string; code: string; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listSubjects(tenantId);
  }

  @Post('subjects')
  @ApiOperation({ summary: 'Create subject' })
  @Permissions('SUBJECT_CREATE')
  async createSubject(
    @Body() dto: CreateSubjectDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createSubject(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('subjects/:id')
  @ApiOperation({ summary: 'Update subject' })
  @Permissions('SUBJECT_CREATE')
  async updateSubject(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateSubject(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('subjects/:id')
  @ApiOperation({ summary: 'Soft-delete subject' })
  @Permissions('SUBJECT_CREATE')
  async deleteSubject(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteSubject(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('students')
  @ApiOperation({ summary: 'Create student' })
  @Permissions('STUDENT_CREATE')
  async createStudent(
    @Body() dto: CreateStudentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createStudent(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('teachers')
  @ApiOperation({ summary: 'List teachers for tenant' })
  @Permissions('TEACHER_ASSIGN')
  async listTeachers(
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{ id: string; firstName: string | null; lastName: string | null; email: string | null; contactPhone: string | null; employeeCode: string; designation: string; isActive: boolean; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listTeachers(tenantId);
  }

  @Post('teachers')
  @ApiOperation({ summary: 'Create teacher' })
  @Permissions('TEACHER_ASSIGN')
  async createTeacher(
    @Body() dto: CreateTeacherDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createTeacher(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('teachers/:id')
  @ApiOperation({ summary: 'Update teacher' })
  @Permissions('TEACHER_ASSIGN')
  async updateTeacher(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateTeacher(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('teachers/:id')
  @ApiOperation({ summary: 'Soft-delete teacher' })
  @Permissions('TEACHER_ASSIGN')
  async deleteTeacher(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteTeacher(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('teachers/assignments')
  @ApiOperation({ summary: 'Assign class teacher' })
  @Permissions('TEACHER_ASSIGN')
  async assignTeacher(
    @Body() dto: AssignClassTeacherDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.assignClassTeacher(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('students/enrollments')
  @ApiOperation({ summary: 'Enroll student into class/section/year' })
  @Permissions('STUDENT_CREATE')
  async enrollStudent(
    @Body() dto: CreateStudentEnrollmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.enrollStudent(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }
}