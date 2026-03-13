import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePeriodDto {
  @ApiPropertyOptional({ example: 'Period 1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: '09:15', description: 'Start time in HH:MM 24-hour format' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ example: '10:00', description: 'End time in HH:MM 24-hour format' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ example: 1, description: 'Sort order within the daily schedule' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orderIndex?: number;

  @ApiPropertyOptional({ example: 'b11f3e4e-2a28-44e2-8b81-400c8d98f241' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'When true and endTime is changing, shift all subsequent periods by the same delta',
  })
  @IsOptional()
  @IsBoolean()
  cascadeUpdates?: boolean;
}
