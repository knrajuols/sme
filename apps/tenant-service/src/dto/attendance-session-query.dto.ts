import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AttendanceSessionQueryDto {
  @ApiPropertyOptional({ example: '2026-03-10' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ example: '4e9b51b2-81d6-49e4-8586-35af06b48ec4' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ example: 'efcdd27b-7bf4-4321-b99e-4b6f2aa7d7be' })
  @IsOptional()
  @IsString()
  sectionId?: string;
}