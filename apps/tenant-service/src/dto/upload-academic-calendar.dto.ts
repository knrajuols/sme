import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for uploading an academic calendar CSV.
 * The `csvContent` field contains the raw CSV text (including header row).
 * The `academicYearId` links entries to a specific academic year.
 */
export class UploadAcademicCalendarDto {
  @ApiProperty({ description: 'UUID of the target academic year' })
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiProperty({ description: 'Raw CSV content including header row' })
  @IsString()
  @IsNotEmpty()
  csvContent!: string;
}

/** Allowed values for the Type column in the calendar CSV. */
export const CALENDAR_ENTRY_TYPES = [
  'Academic',
  'Holiday',
  'Vacation_Start',
  'Vacation_End',
  'Exam',
  'Exam_Start',
  'Exam_End',
  'Event',
  'Celebration',
] as const;

export type CalendarEntryTypeLiteral = (typeof CALENDAR_ENTRY_TYPES)[number];

/** Represents a single validation mismatch found in the CSV. */
export interface CalendarValidationError {
  row: number;
  column: number;
  columnName: string;
  value: string;
  expected: string;
}
