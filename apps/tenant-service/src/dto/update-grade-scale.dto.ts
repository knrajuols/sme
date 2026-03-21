import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateGradeScaleDto {
  @ApiPropertyOptional({ example: 'A1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'A1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  grade?: string;

  @ApiPropertyOptional({ example: 91 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minPercentage?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercentage?: number;

  @ApiPropertyOptional({ example: 10.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  gradePoint?: number;

  @ApiPropertyOptional({ example: 'Outstanding' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  performanceIndicator?: string;
}
