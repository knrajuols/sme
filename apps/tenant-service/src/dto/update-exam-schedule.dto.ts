import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateExamScheduleDto {
  @ApiPropertyOptional({ example: 'Mid-Term Examination' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'ALL' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetClasses?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
}
