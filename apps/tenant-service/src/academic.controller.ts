import { Body, Controller, Headers, Post } from '@nestjs/common';
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

@ApiTags('Academic')
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

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