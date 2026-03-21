import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGradeScaleDto {
  @ApiProperty({ example: 'A1' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'A1' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  grade!: string;

  @ApiProperty({ example: 91 })
  @IsNumber()
  @Min(0)
  @Max(100)
  minPercentage!: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercentage!: number;

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
