import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateFeeStructureDto {
  @ApiPropertyOptional({ example: 'b11f3e4e-2a28-44e2-8b81-400c8d98f241' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({ example: 'c22f3e4e-3b39-55f3-9c92-511d9e09g352' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ example: 'd33f4e5e-4c4a-66g4-ad03-622eaf1ah463' })
  @IsOptional()
  @IsString()
  feeCategoryId?: string;

  @ApiPropertyOptional({ example: 1500.0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: '2025-04-10' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
