import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePeriodDto {
  @ApiProperty({ example: 'Period 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: '09:15', description: 'Start time in HH:MM 24-hour format' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:MM format (24-hour)' })
  startTime!: string;

  @ApiProperty({ example: '10:00', description: 'End time in HH:MM 24-hour format' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:MM format (24-hour)' })
  endTime!: string;

  @ApiPropertyOptional({ example: 1, description: 'Sort order within the daily schedule (1-based)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  orderIndex?: number;

  @ApiPropertyOptional({ example: 'b11f3e4e-2a28-44e2-8b81-400c8d98f241', description: 'Optional academic year this period belongs to' })
  @IsOptional()
  @IsString()
  academicYearId?: string;
}
