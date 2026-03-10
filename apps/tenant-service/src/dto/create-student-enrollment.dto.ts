import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStudentEnrollmentDto {
  @ApiProperty({ example: 'f206c4dc-3c98-4438-9988-c9ff7ea5e0fb' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: '7b75c5bc-bff7-4afe-a956-d9f9b5fdc08a' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: 'bbf03dca-0893-4b66-81cd-5d7dc96f7397' })
  @IsString()
  sectionId!: string;

  @ApiProperty({ example: 'b11f3e4e-2a28-44e2-8b81-400c8d98f241' })
  @IsString()
  academicYearId!: string;

  @ApiProperty({ example: '12' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  rollNumber!: string;
}