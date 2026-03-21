import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO for saving the Event-Blob attendance log.
 * The attendanceBlob is a JSON string containing all student/teacher attendance.
 * Format: { students: { "<id>": { s: "P"|"OD"|"SL"|"CL"|"HL"|"A", r?: "remark" } },
 *           teachers: { "<id>": { s: "P"|"OD"|"SL"|"CL"|"HL"|"A", in?: "HH:mm", out?: "HH:mm" } } }
 */
export class SaveAttendanceLogDto {
  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'uuid-class-id' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: 'uuid-section-id' })
  @IsString()
  sectionId!: string;

  @ApiProperty({ example: 'uuid-academic-year-id' })
  @IsString()
  academicYearId!: string;

  @ApiProperty({ description: 'JSON string with student+teacher attendance blob' })
  @IsString()
  attendanceBlob!: string;

  @ApiPropertyOptional({ description: '0=Draft, 1=Locked', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}
