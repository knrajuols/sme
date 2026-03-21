/**
 * Issue-219: Nested enrollment DTO — embedded inside CreateStudentDto and UpdateStudentDto
 * so that the backend can perform a single atomic Prisma transaction for both operations.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class EnrollStudentDto {
  @ApiProperty({ example: 'b11f3e4e-2a28-44e2-8b81-400c8d98f241' })
  @IsUUID()
  academicYearId!: string;

  @ApiProperty({ example: '7b75c5bc-bff7-4afe-a956-d9f9b5fdc08a' })
  @IsUUID()
  classId!: string;

  // Issue-231: Section is optional — not all schools use sections
  @ApiPropertyOptional({ example: 'bbf03dca-0893-4b66-81cd-5d7dc96f7397' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  // Issue-231: Roll number is optional — can be assigned later
  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rollNumber?: string;
}
