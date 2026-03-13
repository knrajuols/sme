import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MarkRecordItemDto {
  @ApiProperty({ example: '70aca6ba-500a-48b3-bd86-d39ab30cf1e2' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 85.5, description: 'Marks obtained; use 0 if absent' })
  @IsNumber()
  @Min(0)
  obtainedMarks!: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @ApiPropertyOptional({ example: 'Good attempt' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class BulkMarksDto {
  @ApiProperty({ example: 'f7b1c2d3-4e5a-6b7c-8d9e-0f1a2b3c4d5e' })
  @IsString()
  examSubjectId!: string;

  @ApiProperty({ example: '4e9b51b2-81d6-49e4-8586-35af06b48ec4' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: 'efcdd27b-7bf4-4321-b99e-4b6f2aa7d7be' })
  @IsString()
  sectionId!: string;

  @ApiProperty({ type: [MarkRecordItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkRecordItemDto)
  records!: MarkRecordItemDto[];
}
