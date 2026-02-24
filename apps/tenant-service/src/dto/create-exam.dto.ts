import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExamDto {
  @ApiProperty({ example: 'Mid Term' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'deb2494c-37d6-4690-bd58-a724aa2ad257' })
  @IsString()
  academicYearId!: string;

  @ApiProperty({ example: '4e9b51b2-81d6-49e4-8586-35af06b48ec4' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ example: '2026-10-15T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  totalMarks?: number;
}