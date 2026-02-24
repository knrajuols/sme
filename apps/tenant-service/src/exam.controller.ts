import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';
import type { Request } from 'express';

import { AddExamSubjectDto } from './dto/add-exam-subject.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { EnterStudentMarksDto } from './dto/enter-student-marks.dto';
import { ExamService } from './exam.service';

interface RequestWithContext extends Request {
  user: JwtClaims;
  tenantId: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Post('exams')
  @Permissions('EXAM_CREATE')
  createExam(@Body() dto: CreateExamDto, @Req() req: RequestWithContext) {
    return this.examService.createExam(dto, {
      tenantId: req.tenantId,
      user: req.user,
      correlationId: this.getCorrelationId(req),
    });
  }

  @Post('exams/:id/subjects')
  @Permissions('EXAM_SUBJECT_ADD')
  addExamSubject(@Param('id') id: string, @Body() dto: AddExamSubjectDto, @Req() req: RequestWithContext) {
    return this.examService.addExamSubject(id, dto, {
      tenantId: req.tenantId,
      user: req.user,
      correlationId: this.getCorrelationId(req),
    });
  }

  @Post('exams/:id/marks')
  @Permissions('MARKS_ENTER')
  enterMarks(@Param('id') id: string, @Body() dto: EnterStudentMarksDto, @Req() req: RequestWithContext) {
    return this.examService.enterMarks(id, dto, {
      tenantId: req.tenantId,
      user: req.user,
      correlationId: this.getCorrelationId(req),
    });
  }

  @Patch('exams/:id/verify')
  @Permissions('EXAM_VERIFY')
  verifyExam(@Param('id') id: string, @Req() req: RequestWithContext) {
    return this.examService.verifyExam(id, {
      tenantId: req.tenantId,
      user: req.user,
      correlationId: this.getCorrelationId(req),
    });
  }

  @Patch('exams/:id/publish')
  @Permissions('EXAM_PUBLISH')
  publishExam(@Param('id') id: string, @Req() req: RequestWithContext) {
    return this.examService.publishExam(id, {
      tenantId: req.tenantId,
      user: req.user,
      correlationId: this.getCorrelationId(req),
    });
  }

  @Get('exams/:id')
  @Permissions('RESULT_VIEW')
  getExam(@Param('id') id: string, @Req() req: RequestWithContext) {
    return this.examService.getExamById(id, req.tenantId);
  }

  @Get('exams/:id/results')
  @Permissions('RESULT_VIEW')
  getExamResults(@Param('id') id: string, @Req() req: RequestWithContext) {
    return this.examService.getExamResults(id, req.tenantId);
  }

  @Get('students/:studentId/results')
  @Permissions('RESULT_VIEW')
  getStudentResults(@Param('studentId') studentId: string, @Req() req: RequestWithContext) {
    return this.examService.getStudentResults(studentId, req.tenantId);
  }

  private getCorrelationId(request: Request): string {
    const headerValue = request.headers['x-correlation-id'];
    if (Array.isArray(headerValue)) {
      return headerValue[0] ?? 'tenant-service';
    }

    if (typeof headerValue === 'string' && headerValue.length > 0) {
      return headerValue;
    }

    return 'tenant-service';
  }
}