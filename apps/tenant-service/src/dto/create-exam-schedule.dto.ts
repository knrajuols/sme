import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateExamScheduleDto {
  @ApiProperty({ example: 'Mid-Term Examination' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'deb2494c-37d6-4690-bd58-a724aa2ad257' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({ example: 'ALL', default: 'ALL' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetClasses?: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ example: '2026-10-15T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;
}
