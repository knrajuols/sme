import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import {
  CurrentTenant,
  CurrentUser,
  Permissions,
} from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';

import { AcademicService } from './academic.service';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto';
import { AssignTeacherSubjectsDto } from './dto/assign-teacher-subjects.dto';
import { BulkAttendanceDto } from './dto/create-bulk-attendance.dto';
import { SaveAttendanceLogDto } from './dto/save-attendance-log.dto';
import { BulkMarksDto } from './dto/create-bulk-marks.dto';
import { CreateGradeScaleDto } from './dto/create-grade-scale.dto';
import { UpdateGradeScaleDto } from './dto/update-grade-scale.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { CreateExamSubjectDto } from './dto/create-exam-subject.dto';
import { UpdateExamSubjectDto } from './dto/update-exam-subject.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateParentDto } from './dto/create-parent.dto';
import { CreateParentStudentMappingDto } from './dto/create-parent-student-mapping.dto';
import { CreatePeriodDto } from './dto/create-period.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';
import { SeedSectionsDto } from './dto/seed-sections.dto';
import { CreateStudentEnrollmentDto } from './dto/create-student-enrollment.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UpdateClassTeacherAssignmentDto } from './dto/update-class-teacher-assignment.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentEnrollmentDto } from './dto/update-student-enrollment.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import {
  SaveWeekendConfigDto,
  SaveMatrixRulesDto,
  GenerateHolidaysDto,
  CreateHolidayEntryDto,
  UpdateHolidayEntryDto,
} from './dto/holiday-engine.dto';

@ApiTags('Academic')
@Controller('academic')
@UseGuards(RolesGuard)
@Roles('SCHOOL_ADMIN')
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

  @Post('years/seed')
  @ApiOperation({ summary: 'Seed 3 sample academic years for empty-state onboarding' })
  async seedAcademicYears(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedAcademicYears({
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

  @Post('classes/seed')
  @ApiOperation({ summary: 'Seed Class 1–12 linked to an Academic Year (defaults to active)' })
  async seedClasses(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Body() body: { academicYearId?: string },
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedClasses(
      {
        tenantId,
        userId: user.sub,
        role: user.roles[0] ?? 'USER',
        correlationId: correlationIdHeader ?? randomUUID(),
      },
      body?.academicYearId,
    );
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  @Post('sections/seed')
  @ApiOperation({ summary: 'Seed 10 section names (Alphabetic or Thematic) — no class associations' })
  async seedSections(
    @Body() dto: SeedSectionsDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedSections(
      {
        tenantId,
        userId: user.sub,
        role: user.roles[0] ?? 'USER',
        correlationId: correlationIdHeader ?? randomUUID(),
      },
      dto.namingStyle,
    );
  }

  @Get('sections')
  @ApiOperation({ summary: 'List sections for tenant' })
  @Permissions('SECTION_CREATE')
  async listSections(
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{ id: string; name: string; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listSections(tenantId);
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

  // ── Class Sections ─────────────────────────────────────────────────────────

  @Get('class-sections')
  @ApiOperation({ summary: 'List class-section assignments (optionally filtered by classId)' })
  @Permissions('SECTION_CREATE')
  async listClassSections(
    @CurrentTenant() tenantId: string,
    @Query('classId') classId?: string,
  ): Promise<Array<{ id: string; name: string; classId: string; className: string; sectionId: string; sectionName: string; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listClassSections(tenantId, classId);
  }

  @Post('class-sections')
  @ApiOperation({ summary: 'Assign a section to a class with a display name' })
  @Permissions('SECTION_CREATE')
  async createClassSection(
    @Body() dto: CreateClassSectionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createClassSection(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('class-sections/:id')
  @ApiOperation({ summary: 'Update class-section display name' })
  @Permissions('SECTION_CREATE')
  async updateClassSection(
    @Param('id') id: string,
    @Body() dto: UpdateClassSectionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateClassSection(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('class-sections/:id')
  @ApiOperation({ summary: 'Soft-delete class-section assignment' })
  @Permissions('SECTION_CREATE')
  async deleteClassSection(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteClassSection(id, {
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
  ): Promise<Array<{ id: string; name: string; code: string; status: string; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listSubjects(tenantId);
  }

  @Post('subjects/seed')
  @ApiOperation({ summary: 'Seed global subject pool (17 languages + 7 core academic)' })
  async seedSubjects(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedSubjects({
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
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

  @Patch('subjects/:id/status')
  @ApiOperation({ summary: 'Toggle subject ACTIVE / INACTIVE status' })
  @Permissions('SUBJECT_CREATE')
  async updateSubjectStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'INACTIVE' },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    if (!['ACTIVE', 'INACTIVE'].includes(body.status)) {
      throw new BadRequestException('[ERR-ACAD-SUBJ-4000] status must be ACTIVE or INACTIVE');
    }
    return this.academicService.updateSubjectStatus(id, body.status, {
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

  @Get('students')
  @ApiOperation({ summary: 'List students for tenant' })
  @Permissions('STUDENT_CREATE')
  async listStudents(
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.listStudents(tenantId);
  }

  @Get('students/:id')
  @ApiOperation({ summary: 'Get a single student by ID' })
  @Permissions('STUDENT_CREATE')
  async getStudent(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getStudent(id, tenantId);
  }

  @Patch('students/:id')
  @ApiOperation({ summary: 'Update student' })
  @Permissions('STUDENT_CREATE')
  async updateStudent(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateStudent(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('students/:id')
  @ApiOperation({ summary: 'Soft-delete student' })
  @Permissions('STUDENT_CREATE')
  async deleteStudent(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteStudent(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Teacher ────────────────────────────────────────────────────────────────

  @Get('teachers')
  @ApiOperation({ summary: 'List teachers for tenant' })
  @Permissions('TEACHER_ASSIGN')
  async listTeachers(
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{ id: string; firstName: string | null; lastName: string | null; email: string | null; contactPhone: string | null; employeeCode: string; designation: string; isActive: boolean; createdAt: Date; updatedAt: Date }>> {
    return this.academicService.listTeachers(tenantId);
  }

  @Get('teachers/:id')
  @ApiOperation({ summary: 'Get a single teacher by ID' })
  @Permissions('TEACHER_ASSIGN')
  async getTeacher(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getTeacher(id, tenantId);
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

  // ── Teacher-Subject M2M ────────────────────────────────────────────────────

  @Get('teachers/:id/subjects')
  @ApiOperation({ summary: 'List subjects assigned to a teacher' })
  @Permissions('TEACHER_ASSIGN')
  async getTeacherSubjects(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getTeacherSubjects(id, tenantId);
  }

  @Post('teachers/:id/subjects')
  @ApiOperation({ summary: 'Assign subjects to a teacher (M2M)' })
  @Permissions('TEACHER_ASSIGN')
  async assignTeacherSubjects(
    @Param('id') id: string,
    @Body() dto: AssignTeacherSubjectsDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ assigned: number }> {
    return this.academicService.assignTeacherSubjects(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('teachers/:id/subjects/:subjectId')
  @ApiOperation({ summary: 'Remove a subject from a teacher (M2M)' })
  @Permissions('TEACHER_ASSIGN')
  async removeTeacherSubject(
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ removed: boolean }> {
    return this.academicService.removeTeacherSubject(id, subjectId, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── StudentEnrollment ──────────────────────────────────────────────────────

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

  @Get('students/enrollments')
  @ApiOperation({ summary: 'List enrollments for tenant (optionally filtered by studentId or academicYearId)' })
  @Permissions('STUDENT_CREATE')
  async listEnrollments(
    @CurrentTenant() tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.academicService.listEnrollments(tenantId, studentId, academicYearId);
  }

  @Delete('students/enrollments/:id')
  @ApiOperation({ summary: 'Soft-delete a student enrollment' })
  @Permissions('STUDENT_CREATE')
  async deleteEnrollment(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteEnrollment(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Parents ────────────────────────────────────────────────────────────────

  @Get('parents')
  @ApiOperation({ summary: 'List parents for tenant' })
  @Permissions('STUDENT_CREATE')
  async listParents(
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.listParents(tenantId);
  }

  @Get('parents/:id')
  @ApiOperation({ summary: 'Get a single parent by ID' })
  @Permissions('STUDENT_CREATE')
  async getParent(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getParent(id, tenantId);
  }

  @Post('parents')
  @ApiOperation({ summary: 'Create parent' })
  @Permissions('STUDENT_CREATE')
  async createParent(
    @Body() dto: CreateParentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createParent(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('parents/:id')
  @ApiOperation({ summary: 'Update parent' })
  @Permissions('STUDENT_CREATE')
  async updateParent(
    @Param('id') id: string,
    @Body() dto: UpdateParentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateParent(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('parents/:id')
  @ApiOperation({ summary: 'Soft-delete parent' })
  @Permissions('STUDENT_CREATE')
  async deleteParent(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteParent(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── ParentStudentMapping ───────────────────────────────────────────────────

  @Get('parents/mappings')
  @ApiOperation({ summary: 'List parent-student mappings for tenant' })
  @Permissions('STUDENT_CREATE')
  async listParentStudentMappings(
    @CurrentTenant() tenantId: string,
    @Query('parentId') parentId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.academicService.listParentStudentMappings(tenantId, parentId, studentId);
  }

  @Post('parents/mappings')
  @ApiOperation({ summary: 'Create parent-student mapping' })
  @Permissions('STUDENT_CREATE')
  async createParentStudentMapping(
    @Body() dto: CreateParentStudentMappingDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createParentStudentMapping(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('parents/mappings/:id')
  @ApiOperation({ summary: 'Delete parent-student mapping' })
  @Permissions('STUDENT_CREATE')
  async deleteParentStudentMapping(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteParentStudentMapping(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Enrollments (/academic/enrollments) ───────────────────────────────────

  @Get('enrollments')
  @ApiOperation({ summary: 'List all enrollments (optionally filter by studentId, academicYearId, classId, sectionId)' })
  @Permissions('STUDENT_CREATE')
  async listEnrollmentsV2(
    @CurrentTenant() tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.academicService.listEnrollments(tenantId, studentId, academicYearId, classId, sectionId);
  }

  @Post('enrollments')
  @ApiOperation({ summary: 'Enroll student into class/section/year' })
  @Permissions('STUDENT_CREATE')
  async enrollStudentV2(
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

  @Get('enrollments/:id')
  @ApiOperation({ summary: 'Get a single enrollment' })
  @Permissions('STUDENT_CREATE')
  async getEnrollment(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getEnrollment(id, tenantId);
  }

  @Patch('enrollments/:id')
  @ApiOperation({ summary: 'Update enrollment (e.g. roll number)' })
  @Permissions('STUDENT_CREATE')
  async updateEnrollment(
    @Param('id') id: string,
    @Body() dto: UpdateStudentEnrollmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateEnrollment(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('enrollments/:id')
  @ApiOperation({ summary: 'Soft-delete enrollment' })
  @Permissions('STUDENT_CREATE')
  async deleteEnrollmentV2(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteEnrollment(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Class-Teacher Assignments (/academic/class-teachers) ────────────────────

  @Get('class-teachers')
  @ApiOperation({ summary: 'List all class-teacher assignments' })
  @Permissions('TEACHER_ASSIGN')
  async listClassTeacherAssignments(
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.listClassTeacherAssignments(tenantId);
  }

  @Post('class-teachers')
  @ApiOperation({ summary: 'Create class-teacher assignment' })
  @Permissions('TEACHER_ASSIGN')
  async createClassTeacherAssignment(
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

  @Get('class-teachers/:id')
  @ApiOperation({ summary: 'Get a single class-teacher assignment' })
  @Permissions('TEACHER_ASSIGN')
  async getClassTeacherAssignment(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getClassTeacherAssignment(id, tenantId);
  }

  @Patch('class-teachers/:id')
  @ApiOperation({ summary: 'Update class-teacher assignment' })
  @Permissions('TEACHER_ASSIGN')
  async updateClassTeacherAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateClassTeacherAssignmentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateClassTeacherAssignment(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('class-teachers/:id')
  @ApiOperation({ summary: 'Delete class-teacher assignment' })
  @Permissions('TEACHER_ASSIGN')
  async deleteClassTeacherAssignment(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteClassTeacherAssignment(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Periods (/academic/periods) ───────────────────────────────────────────

  @Get('periods')
  @ApiOperation({ summary: 'List periods (optionally filter by academicYearId)' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async listPeriods(
    @CurrentTenant() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.academicService.listPeriods(tenantId, academicYearId);
  }

  @Post('periods')
  @ApiOperation({ summary: 'Create a period' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async createPeriod(
    @Body() dto: CreatePeriodDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createPeriod(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('periods/seed')
  @ApiOperation({ summary: 'Seed 10 standard school periods linked to the active Academic Year' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async seedPeriods(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedPeriods({
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('periods/seed-from-master')
  @ApiOperation({ summary: 'Copy master template periods into this school (idempotent)' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async seedPeriodsFromMaster(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedPeriodsFromMaster({
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('years/seed-from-master')
  @ApiOperation({ summary: 'Copy master template academic years into this school' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async seedAcademicYearsFromMaster(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedAcademicYearsFromMaster({
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('classes/seed-from-master')
  @ApiOperation({ summary: 'Copy master template classes into this school for a specific academic year' })
  @Permissions('CLASS_CREATE')
  async seedClassesFromMaster(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Body() body: { academicYearId?: string },
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedClassesFromMaster(
      {
        tenantId,
        userId: user.sub,
        role: user.roles[0] ?? 'USER',
        correlationId: correlationIdHeader ?? randomUUID(),
      },
      body?.academicYearId,
    );
  }

  @Post('sections/seed-from-master')
  @ApiOperation({ summary: 'Copy master template section pool into this school' })
  @Permissions('CLASS_CREATE')
  async seedSectionsFromMaster(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedSectionsFromMaster({
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('subjects/seed-from-master')
  @ApiOperation({ summary: 'Copy master template subjects into this school' })
  @Permissions('CLASS_CREATE')
  async seedSubjectsFromMaster(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedSubjectsFromMaster({
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('periods/:id')
  @ApiOperation({ summary: 'Get a single period' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getPeriod(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getPeriod(id, tenantId);
  }

  @Patch('periods/:id')
  @ApiOperation({ summary: 'Update a period' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async updatePeriod(
    @Param('id') id: string,
    @Body() dto: UpdatePeriodDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updatePeriod(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('periods/:id')
  @ApiOperation({ summary: 'Soft-delete a period' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async deletePeriod(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deletePeriod(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Attendance ──────────────────────────────────────────────────────────────

  @Post('attendance/bulk')
  @ApiOperation({ summary: 'Save bulk attendance (creates or replaces session + records in one transaction)' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('STUDENT_CREATE')
  async saveBulkAttendance(
    @Body() dto: BulkAttendanceDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ sessionId: string }> {
    return this.academicService.saveBulkAttendance(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('attendance/sessions')
  @ApiOperation({ summary: 'List attendance sessions for tenant (optionally filtered by date, classId, sectionId)' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('STUDENT_CREATE')
  async listAttendanceSessions(
    @CurrentTenant() tenantId: string,
    @Query('date') date?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.academicService.listAttendanceSessions(tenantId, date, classId, sectionId);
  }

  @Get('attendance/sessions/:id')
  @ApiOperation({ summary: 'Get a single attendance session with its records' })
  @Permissions('STUDENT_CREATE')
  async getAttendanceSession(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getAttendanceSession(id, tenantId);
  }

  // ── Event-Blob Attendance Log ────────────────────────────────────────────────

  @Post('attendance/log')
  @ApiOperation({ summary: 'Save daily attendance log (Event-Blob: one row per class per day)' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('STUDENT_CREATE')
  async saveAttendanceLog(
    @Body() dto: SaveAttendanceLogDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string; created: boolean }> {
    return this.academicService.saveAttendanceLog(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('attendance/log')
  @ApiOperation({ summary: 'Get daily attendance log blob by date + class + section' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('STUDENT_CREATE')
  async getAttendanceLog(
    @Query('date') date: string,
    @Query('classId') classId: string,
    @Query('sectionId') sectionId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getAttendanceLog(tenantId, date, classId, sectionId);
  }

  @Get('attendance/holiday-status')
  @ApiOperation({ summary: 'Get holiday status for a specific date in an academic year' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('STUDENT_CREATE')
  async getHolidayStatus(
    @Query('date') date: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getHolidayStatus(tenantId, academicYearId, date);
  }

  @Post('attendance/log/:id/lock')
  @ApiOperation({ summary: 'Lock or unlock a daily attendance log' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('STUDENT_CREATE')
  async lockAttendanceLog(
    @Param('id') id: string,
    @Query('lock') lock: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
  ): Promise<{ id: string; status: number }> {
    return this.academicService.lockAttendanceLog(tenantId, id, lock !== 'false', user.sub);
  }

  @Get('attendance/report')
  @ApiOperation({ summary: 'Attendance aggregation report for a class+section over a date range' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('STUDENT_CREATE')
  async getAttendanceReport(
    @Query('classId') classId: string,
    @Query('sectionId') sectionId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('viewType') viewType: string,
    @CurrentTenant() tenantId: string,
  ) {
    const vt = viewType === 'teachers' ? 'teachers' : 'students';
    return this.academicService.getAttendanceReport(tenantId, classId, sectionId, startDate, endDate, vt);
  }

  // ── GradeScale ───────────────────────────────────────────────────────────────

  @Get('grade-scales')
  @ApiOperation({ summary: 'List grade scales for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async listGradeScales(@CurrentTenant() tenantId: string) {
    return this.academicService.listGradeScales(tenantId);
  }

  @Post('grade-scales')
  @ApiOperation({ summary: 'Create grade scale' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async createGradeScale(
    @Body() dto: CreateGradeScaleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createGradeScale(dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('grade-scales/:id')
  @ApiOperation({ summary: 'Get a single grade scale' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getGradeScale(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.academicService.getGradeScale(id, tenantId);
  }

  @Patch('grade-scales/:id')
  @ApiOperation({ summary: 'Update grade scale' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async updateGradeScale(
    @Param('id') id: string,
    @Body() dto: UpdateGradeScaleDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateGradeScale(id, dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('grade-scales/:id')
  @ApiOperation({ summary: 'Soft-delete grade scale' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async deleteGradeScale(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteGradeScale(id, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Exams ──────────────────────────────────────────────────────────────────

  @Get('exams')
  @ApiOperation({ summary: 'List exams for tenant (optionally filter by academicYearId or classId)' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async listExams(
    @CurrentTenant() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.academicService.listExams(tenantId, academicYearId, classId);
  }

  @Post('exams')
  @ApiOperation({ summary: 'Create exam' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async createExam(
    @Body() dto: CreateExamDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createExam(dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('exams/:id')
  @ApiOperation({ summary: 'Get a single exam' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getExam(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.academicService.getExam(id, tenantId);
  }

  @Patch('exams/:id')
  @ApiOperation({ summary: 'Update exam' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async updateExam(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateExam(id, dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('exams/:id')
  @ApiOperation({ summary: 'Soft-delete exam' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async deleteExam(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteExam(id, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── ExamSubjects ────────────────────────────────────────────────────────────

  @Get('exam-subjects')
  @ApiOperation({ summary: 'List exam subjects for tenant (optionally filter by examId)' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async listExamSubjects(
    @CurrentTenant() tenantId: string,
    @Query('examId') examId?: string,
  ) {
    return this.academicService.listExamSubjects(tenantId, examId);
  }

  @Post('exam-subjects')
  @ApiOperation({ summary: 'Create exam subject' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async createExamSubject(
    @Body() dto: CreateExamSubjectDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.academicService.createExamSubject(dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('exam-subjects/:id')
  @ApiOperation({ summary: 'Get a single exam subject' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getExamSubject(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.academicService.getExamSubject(id, tenantId);
  }

  @Patch('exam-subjects/:id')
  @ApiOperation({ summary: 'Update exam subject' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async updateExamSubject(
    @Param('id') id: string,
    @Body() dto: UpdateExamSubjectDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.academicService.updateExamSubject(id, dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('exam-subjects/:id')
  @ApiOperation({ summary: 'Soft-delete exam subject' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async deleteExamSubject(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.academicService.deleteExamSubject(id, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Student Marks ──────────────────────────────────────────────────────────

  @Post('marks/bulk')
  @ApiOperation({ summary: 'Bulk save marks for an exam subject and section' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('ACADEMIC_YEAR_CREATE')
  async saveBulkMarks(
    @Body() dto: BulkMarksDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ count: number }> {
    return this.academicService.saveBulkMarks(dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('marks')
  @ApiOperation({ summary: 'List existing marks for an exam subject and section' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('ACADEMIC_YEAR_CREATE')
  async listMarks(
    @Query('examSubjectId') examSubjectId: string,
    @Query('sectionId') sectionId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.listMarks(tenantId, examSubjectId, sectionId);
  }

  @Get('marks/analytics')
  @ApiOperation({ summary: 'Per-subject mark analytics (max, 2nd, 3rd, min, avg) for an exam + section' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getMarkAnalytics(
    @Query('examId') examId: string,
    @Query('sectionId') sectionId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getMarkAnalytics(tenantId, examId, sectionId);
  }

  @Post('marks/lock-attendance')
  @ApiOperation({ summary: 'Lock attendance for an exam + section (disables absent checkboxes)' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('ACADEMIC_YEAR_CREATE')
  async lockAttendance(
    @Body() body: { examId: string; sectionId: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ locked: boolean }> {
    return this.academicService.lockAttendance(body.examId, body.sectionId, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('marks/attendance-lock')
  @ApiOperation({ summary: 'Get attendance lock status for an exam + section' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getAttendanceLockStatus(
    @Query('examId') examId: string,
    @Query('sectionId') sectionId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getAttendanceLockStatus(tenantId, examId, sectionId);
  }

  @Get('grade-scales')
  @ApiOperation({ summary: 'Get MASTER_TEMPLATE grade scales for analytics use' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getMasterGradeScalesForPortal(@CurrentTenant() _tenantId: string) {
    return this.academicService.listGradeScales('MASTER_TEMPLATE');
  }

  @Get('marks/ranks')
  @ApiOperation({ summary: 'Get marks, grades and ranks matrix for exam + section' })
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getMarksRanks(
    @Query('examId') examId: string,
    @Query('sectionId') sectionId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getMarksRanks(tenantId, examId, sectionId);
  }

  @Post('exams/:examId/classes/:classId/process')
  @ApiOperation({ summary: 'Process and aggregate exam results for a class' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async processExamResults(
    @Param('examId') examId: string,
    @Param('classId') classId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ processed: number }> {
    return this.academicService.processExamResults(examId, classId, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('results/:examId/students/:studentId')
  @ApiOperation({ summary: 'Get processed exam result / report card for a student' })
  @Roles('SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'STUDENT')
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getStudentResult(
    @Param('examId')    examId:    string,
    @Param('studentId') studentId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<object> {
    const result = await this.academicService.getStudentResult(examId, studentId, tenantId);
    if (result === null) return { processed: false };
    return result;
  }

  // ── Onboarding Seeder ───────────────────────────────────────────────────────

  @Post('seed-defaults')
  @ApiOperation({ summary: 'PAN-India Quick Setup: seed default academic structure for a new school' })
  @Roles('SCHOOL_ADMIN')
  async seedDefaultSetup(
    @CurrentTenant() tenantId: string,
    @CurrentUser()   user: JwtClaims,
  ): Promise<{ seeded: number }> {
    return this.academicService.seedDefaultSetup(tenantId, user.sub);
  }

  // ── Holiday Engine (Tenant-Scoped) ──────────────────────────────────────────

  @Post('holidays/weekend-config')
  @ApiOperation({ summary: 'Save weekend holiday configuration for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async saveWeekendConfig(
    @Body() dto: SaveWeekendConfigDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.saveWeekendConfig(dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('holidays/weekend-config')
  @ApiOperation({ summary: 'Get weekend holiday configuration for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getWeekendConfig(
    @Query('academicYearId') academicYearId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getWeekendConfig(tenantId, academicYearId);
  }

  @Post('holidays/matrix-rules')
  @ApiOperation({ summary: 'Save monthly holiday matrix rules for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async saveMatrixRules(
    @Body() dto: SaveMatrixRulesDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.saveMatrixRules(dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('holidays/matrix-rules')
  @ApiOperation({ summary: 'Get monthly holiday matrix rules for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async getMatrixRules(
    @Query('academicYearId') academicYearId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.getMatrixRules(tenantId, academicYearId);
  }

  @Post('holidays/generate')
  @ApiOperation({ summary: 'Generate holidays from calendar + weekend + matrix for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async generateHolidays(
    @Body() dto: GenerateHolidaysDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.generateHolidays(tenantId, dto.academicYearId, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    }, false);
  }

  @Post('holidays/preview')
  @ApiOperation({ summary: 'Preview generated holidays without saving for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async previewHolidays(
    @Body() dto: GenerateHolidaysDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.generateHolidays(tenantId, dto.academicYearId, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    }, true, dto.weekendDays, dto.matrixRules);
  }

  @Get('holidays')
  @ApiOperation({ summary: 'List holiday entries for tenant academic year' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async listHolidays(
    @Query('academicYearId') academicYearId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.listHolidays(tenantId, academicYearId);
  }

  @Post('holidays')
  @ApiOperation({ summary: 'Create a manual holiday entry for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async createHolidayEntry(
    @Body() dto: CreateHolidayEntryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.createHolidayEntry(dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('holidays/:id')
  @ApiOperation({ summary: 'Update a holiday entry for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async updateHolidayEntry(
    @Param('id') id: string,
    @Body() dto: UpdateHolidayEntryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.updateHolidayEntry(id, dto, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('holidays/:id')
  @ApiOperation({ summary: 'Soft-delete a holiday entry for tenant' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async deleteHolidayEntry(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.deleteHolidayEntry(id, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Academic Calendar (Tenant-Scoped) ───────────────────────────────────────

  @Get('academic-calendar')
  @ApiOperation({ summary: 'List academic calendar entries for tenant academic year' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async listCalendar(
    @Query('academicYearId') academicYearId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.academicService.listAcademicCalendar(tenantId, academicYearId);
  }

  // ── Clone from Master Data ──────────────────────────────────────────────────

  @Post('clone/academic-calendar')
  @ApiOperation({ summary: 'Clone academic calendar entries from MASTER_TEMPLATE' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async cloneAcademicCalendar(
    @Body() body: { academicYearId: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.cloneAcademicCalendarFromMaster(body.academicYearId, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Post('clone/holidays')
  @ApiOperation({ summary: 'Clone holidays (weekend + matrix + entries) from MASTER_TEMPLATE' })
  @Permissions('ACADEMIC_YEAR_CREATE')
  async cloneHolidays(
    @Body() body: { academicYearId: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ) {
    return this.academicService.cloneHolidaysFromMaster(body.academicYearId, {
      tenantId, userId: user.sub, role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }
}