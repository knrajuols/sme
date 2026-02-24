import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsString } from 'class-validator';

export class CreateAttendanceSessionDto {
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
}