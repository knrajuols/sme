import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExamSubjectDto {
  @ApiProperty({ example: 'f91b5ac5-4de1-4cba-a254-8d2f9051ed1a' })
  @IsString()
  examId!: string;

  @ApiProperty({ example: 'b3e2c9f1-7a4d-4f8e-9c1b-2d3e4f5a6b7c' })
  @IsString()
  subjectId!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  maxMarks!: number;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightage?: number;
}
