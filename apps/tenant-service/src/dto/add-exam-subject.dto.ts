import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddExamSubjectDto {
  @ApiProperty({ example: '69885257-27bd-4f76-88bb-8bbefe7b3be2' })
  @IsString()
  subjectId!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  maxMarks!: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightage?: number;
}