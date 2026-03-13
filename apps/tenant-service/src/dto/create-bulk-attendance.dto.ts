import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { AttendanceStatus } from '../enums';

class BulkRecordItemDto {
  @ApiProperty({ example: '70aca6ba-500a-48b3-bd86-d39ab30cf1e2' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'PRESENT', enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional({ example: 'Arrived 5 minutes late' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class BulkAttendanceDto {
  @ApiProperty({ example: '2026-03-10' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ example: '4e9b51b2-81d6-49e4-8586-35af06b48ec4' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: 'efcdd27b-7bf4-4321-b99e-4b6f2aa7d7be' })
  @IsString()
  sectionId!: string;

  @ApiProperty({ example: 'deb2494c-37d6-4690-bd58-a724aa2ad257' })
  @IsString()
  academicYearId!: string;

  @ApiProperty({ type: [BulkRecordItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkRecordItemDto)
  records!: BulkRecordItemDto[];
}
