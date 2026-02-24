import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsString, Matches } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @Matches(/^\d{4}-\d{4}$/)
  name!: string;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ example: '2027-03-31T23:59:59.999Z' })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}