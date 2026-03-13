import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { DayOfWeek } from '../generated/prisma-client';

export class UpdateTimetableDto {
  @ApiPropertyOptional({ example: 'uuid-period-id' })
  @IsOptional()
  @IsString()
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({ example: 'uuid-subject-id' })
  @IsOptional()
  @IsString()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'uuid-teacher-id' })
  @IsOptional()
  @IsString()
  @IsUUID()
  teacherId?: string;
}
