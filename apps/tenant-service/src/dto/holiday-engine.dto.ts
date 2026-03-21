import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ─── Weekend Config DTO ─────────────────────────────────────────────────────

export class WeekendDayDto {
  @ApiProperty({ description: 'Day of week: MONDAY..SUNDAY' })
  @IsString()
  @IsNotEmpty()
  dayOfWeek!: string;

  @ApiProperty({ description: 'Mark entire day as weekend holiday' })
  @IsBoolean()
  isFullHoliday!: boolean;

  @ApiProperty({ description: 'First half off' })
  @IsBoolean()
  firstHalfOff!: boolean;

  @ApiProperty({ description: 'Second half off' })
  @IsBoolean()
  secondHalfOff!: boolean;
}

export class SaveWeekendConfigDto {
  @ApiProperty({ description: 'UUID of the target academic year' })
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiProperty({ type: [WeekendDayDto], description: 'Weekend config for each day' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeekendDayDto)
  days!: WeekendDayDto[];
}

// ─── Holiday Matrix Rule DTO ────────────────────────────────────────────────

export class MatrixRuleDto {
  @ApiProperty({ description: 'Day of week: MONDAY..SUNDAY' })
  @IsString()
  @IsNotEmpty()
  dayOfWeek!: string;

  @ApiProperty({ description: 'Occurrence in month (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  occurrence!: number;

  @ApiProperty({ description: 'First half off' })
  @IsBoolean()
  firstHalfOff!: boolean;

  @ApiProperty({ description: 'Second half off' })
  @IsBoolean()
  secondHalfOff!: boolean;
}

export class SaveMatrixRulesDto {
  @ApiProperty({ description: 'UUID of the target academic year' })
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiProperty({ type: [MatrixRuleDto], description: 'Matrix rules for Nth-day policies' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatrixRuleDto)
  rules!: MatrixRuleDto[];
}

// ─── Generate Holidays DTO ──────────────────────────────────────────────────

export class GenerateHolidaysDto {
  @ApiProperty({ description: 'UUID of the target academic year' })
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiPropertyOptional({ type: [WeekendDayDto], description: 'Inline weekend config for preview (uses DB config if omitted)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeekendDayDto)
  @IsOptional()
  weekendDays?: WeekendDayDto[];

  @ApiPropertyOptional({ type: [MatrixRuleDto], description: 'Inline matrix rules for preview (uses DB rules if omitted)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatrixRuleDto)
  @IsOptional()
  matrixRules?: MatrixRuleDto[];
}

// ─── Manual Holiday Entry DTO ───────────────────────────────────────────────

export class CreateHolidayEntryDto {
  @ApiProperty({ description: 'UUID of the target academic year' })
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiProperty({ description: 'Holiday date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ description: 'Occasion/title' })
  @IsString()
  @IsNotEmpty()
  occasion!: string;

  @ApiProperty({ description: 'Type: Holiday, Vacation, Weekend, Half-Day' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ description: 'Is full day holiday' })
  @IsBoolean()
  isFullDay!: boolean;

  @ApiProperty({ description: 'First half only' })
  @IsBoolean()
  isFirstHalf!: boolean;

  @ApiProperty({ description: 'Second half only' })
  @IsBoolean()
  isSecondHalf!: boolean;

  @ApiPropertyOptional({ description: 'Remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class UpdateHolidayEntryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  occasion?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isFullDay?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isFirstHalf?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isSecondHalf?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  remarks?: string;
}
