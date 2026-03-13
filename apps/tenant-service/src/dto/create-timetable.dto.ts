import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID } from 'class-validator';

import { DayOfWeek } from '../generated/prisma-client';

export class CreateTimetableDto {
  @ApiProperty({ example: 'uuid-academic-year-id' })
  @IsString()
  @IsUUID()
  academicYearId!: string;

  @ApiProperty({ example: 'uuid-class-id' })
  @IsString()
  @IsUUID()
  classId!: string;

  @ApiProperty({ example: 'uuid-section-id' })
  @IsString()
  @IsUUID()
  sectionId!: string;

  @ApiProperty({ example: 'uuid-period-id' })
  @IsString()
  @IsUUID()
  periodId!: string;

  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiProperty({ example: 'uuid-subject-id' })
  @IsString()
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: 'uuid-teacher-id' })
  @IsString()
  @IsUUID()
  teacherId!: string;
}
