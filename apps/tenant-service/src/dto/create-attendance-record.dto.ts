import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AttendanceRecordItemDto {
  @ApiProperty({ example: '70aca6ba-500a-48b3-bd86-d39ab30cf1e2' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'PRESENT', enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] })
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status!: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

  @ApiPropertyOptional({ example: 'Arrived 5 minutes late' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  remarks?: string;
}

export class CreateAttendanceRecordDto {
  @ApiProperty({ example: 'f91b5ac5-4de1-4cba-a254-8d2f9051ed1a' })
  @IsString()
  sessionId!: string;

  @ApiProperty({ type: [AttendanceRecordItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordItemDto)
  records!: AttendanceRecordItemDto[];
}